package com.syncplay.audiocapture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.*
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.util.Base64
import androidx.annotation.RequiresApi
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread
import kotlin.math.sqrt

class AudioCaptureModule : Module() {

    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var audioRecord: AudioRecord? = null
    private var isCapturing = false
    private var captureThread: Thread? = null

    // Audio Playback Stream (Guest Sink)
    private var audioTrack: AudioTrack? = null
    private var isPlayingStream = false

    // Pending permission promise
    private var permissionPromise: Promise? = null

    companion object {
        const val REQUEST_CODE_CAPTURE_PERM = 3012
        const val SAMPLE_RATE = 48000
        const val CHANNELS = 2
        const val BIT_DEPTH = 16
        const val FRAME_DURATION_MS = 25 // 25ms chunks for low latency
    }

    override fun definition() = ModuleDefinition {
        Name("SyncPlayAudioCapture")

        Events("onAudioChunk", "onDrmBlocked", "onCaptureStarted", "onCaptureStopped")

        Function("isSupported") {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        }

        AsyncFunction("requestCapturePermission") { promise: Promise ->
            val context = appContext.reactContext ?: run {
                promise.reject("ERR_CONTEXT", "React context not available", null)
                return@AsyncFunction
            }
            val activity = appContext.currentActivity ?: run {
                promise.reject("ERR_ACTIVITY", "Current activity not available", null)
                return@AsyncFunction
            }

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                promise.reject("ERR_UNSUPPORTED", "AudioPlaybackCapture requires Android 10+ (API 29)", null)
                return@AsyncFunction
            }

            permissionPromise = promise
            mediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val captureIntent = mediaProjectionManager!!.createScreenCaptureIntent()
            activity.startActivityForResult(captureIntent, REQUEST_CODE_CAPTURE_PERM)
        }

        AsyncFunction("startCapture") { resultCode: Int, resultData: Intent?, promise: Promise ->
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                promise.reject("ERR_UNSUPPORTED", "AudioPlaybackCapture requires Android 10+", null)
                return@AsyncFunction
            }

            if (isCapturing) {
                promise.resolve(true)
                return@AsyncFunction
            }

            val context = appContext.reactContext ?: run {
                promise.reject("ERR_CONTEXT", "React context not available", null)
                return@AsyncFunction
            }

            try {
                // Start Foreground Service
                val serviceIntent = Intent(context, AudioCaptureService::class.java).apply {
                    action = AudioCaptureService.ACTION_START
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }

                // Obtain MediaProjection
                if (mediaProjectionManager == null) {
                    mediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                }
                mediaProjection = mediaProjectionManager!!.getMediaProjection(resultCode, resultData!!)

                startAudioRecordCapture()
                isCapturing = true
                sendEvent("onCaptureStarted", mapOf("sampleRate" to SAMPLE_RATE, "channels" to CHANNELS))
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("ERR_CAPTURE_START", e.message, e)
            }
        }

        AsyncFunction("stopCapture") { promise: Promise ->
            stopAudioRecordCapture()
            promise.resolve(true)
        }

        AsyncFunction("startPlaybackStream") { promise: Promise ->
            try {
                initAudioTrack()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("ERR_PLAYBACK_START", e.message, e)
            }
        }

        Function("writeAudioChunk") { base64Data: String ->
            try {
                if (isPlayingStream && audioTrack != null) {
                    val bytes = Base64.decode(base64Data, Base64.NO_WRAP)
                    audioTrack?.write(bytes, 0, bytes.size, AudioTrack.WRITE_NON_BLOCKING)
                }
            } catch (e: Exception) {
                // write error ignored for low-latency drop
            }
        }

        AsyncFunction("stopPlaybackStream") { promise: Promise ->
            try {
                audioTrack?.stop()
                audioTrack?.release()
                audioTrack = null
                isPlayingStream = false
                promise.resolve(true)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }

        OnActivityResult { _, payload ->
            if (payload.requestCode == REQUEST_CODE_CAPTURE_PERM) {
                if (payload.resultCode == Activity.RESULT_OK && payload.data != null) {
                    permissionPromise?.resolve(mapOf(
                        "granted" to true,
                        "resultCode" to payload.resultCode,
                        "data" to payload.data
                    ))
                } else {
                    permissionPromise?.resolve(mapOf("granted" to false))
                }
                permissionPromise = null
            }
        }
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun startAudioRecordCapture() {
        val proj = mediaProjection ?: return

        // AudioPlaybackCaptureConfiguration for system audio (Media, Games, Unknown)
        val config = AudioPlaybackCaptureConfiguration.Builder(proj)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
            .build()

        val audioFormat = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
            .build()

        // 25ms chunk size: (48000 samples/sec * 0.025s * 2 channels * 2 bytes/sample) = 4800 bytes
        val chunkSize = (SAMPLE_RATE * (FRAME_DURATION_MS / 1000.0) * CHANNELS * (BIT_DEPTH / 8)).toInt()
        val minBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_STEREO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val bufferSize = maxOf(minBufferSize, chunkSize * 4)

        audioRecord = AudioRecord.Builder()
            .setAudioFormat(audioFormat)
            .setAudioPlaybackCaptureConfig(config)
            .setBufferSizeInBytes(bufferSize)
            .build()

        audioRecord!!.startRecording()

        captureThread = thread(start = true, priority = Thread.MAX_PRIORITY) {
            val audioBuffer = ByteArray(chunkSize)
            var sequenceNumber = 0L
            var zeroRmsStreakFrames = 0
            val maxZeroFramesThreshold = (4000 / FRAME_DURATION_MS) // 4 seconds of continuous zero frames

            while (isCapturing && audioRecord != null) {
                val bytesRead = audioRecord!!.read(audioBuffer, 0, chunkSize)
                if (bytesRead > 0) {
                    // Calculate RMS to monitor audio energy and detect DRM blocks
                    val rms = calculateRms(audioBuffer, bytesRead)

                    if (rms < 0.001) {
                        zeroRmsStreakFrames++
                        if (zeroRmsStreakFrames == maxZeroFramesThreshold) {
                            // Notify DRM-protected silence detected
                            sendEvent("onDrmBlocked", mapOf(
                                "message" to "This app's audio is protected and can't be shared."
                            ))
                        }
                    } else {
                        zeroRmsStreakFrames = 0
                    }

                    val base64Data = Base64.encodeToString(audioBuffer, 0, bytesRead, Base64.NO_WRAP)
                    sequenceNumber++

                    sendEvent("onAudioChunk", mapOf(
                        "data" to base64Data,
                        "timestamp" to System.currentTimeMillis(),
                        "seq" to sequenceNumber,
                        "rms" to rms
                    ))
                }
            }
        }
    }

    private fun stopAudioRecordCapture() {
        isCapturing = false
        captureThread?.interrupt()
        captureThread = null

        try {
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {
            // ignore
        }

        try {
            mediaProjection?.stop()
            mediaProjection = null
        } catch (e: Exception) {
            // ignore
        }

        val context = appContext.reactContext
        if (context != null) {
            val serviceIntent = Intent(context, AudioCaptureService::class.java).apply {
                action = AudioCaptureService.ACTION_STOP
            }
            context.startService(serviceIntent)
        }

        sendEvent("onCaptureStopped", emptyMap<String, Any>())
    }

    private fun initAudioTrack() {
        if (isPlayingStream && audioTrack != null) return

        val minBufferSize = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_STEREO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .build()

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(attributes)
            .setAudioFormat(format)
            .setBufferSizeInBytes(minBufferSize * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack!!.play()
        isPlayingStream = true
    }

    private fun calculateRms(buffer: ByteArray, length: Int): Double {
        var sum = 0.0
        val numSamples = length / 2
        if (numSamples == 0) return 0.0

        val shortBuffer = ByteBuffer.wrap(buffer, 0, length).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
        for (i in 0 until numSamples) {
            val sample = shortBuffer.get(i).toDouble() / 32768.0
            sum += sample * sample
        }
        return sqrt(sum / numSamples)
    }
}
