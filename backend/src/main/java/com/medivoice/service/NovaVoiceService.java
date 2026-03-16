package com.medivoice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.reactivestreams.Publisher;
import org.reactivestreams.Subscriber;
import org.reactivestreams.Subscription;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockruntime.model.BidirectionalInputPayloadPart;
import software.amazon.awssdk.services.bedrockruntime.model.BidirectionalOutputPayloadPart;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelWithBidirectionalStreamInput;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelWithBidirectionalStreamRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelWithBidirectionalStreamResponseHandler;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Nova Voice Service — Speech-to-Text and Text-to-Speech
 * using Amazon Nova Sonic (amazon.nova-sonic-v1:0) via HTTP/2 bidirectional streaming.
 *
 * KEY FIX: Uses a synchronous ListPublisher (org.reactivestreams.Publisher) instead of
 * SubmissionPublisher+FlowAdapters. SubmissionPublisher drops items submitted before
 * the async subscriber attaches, causing the stream to close with zero events sent.
 * A synchronous Publisher delivers items exactly when the subscriber calls request(n).
 */
@Service
public class NovaVoiceService {

    private static final Logger log = LoggerFactory.getLogger(NovaVoiceService.class);
    private static final String NOVA_SONIC_MODEL_ID = "amazon.nova-sonic-v1:0";
    private static final int STREAM_TIMEOUT_SECONDS = 40;

    @Autowired
    private BedrockRuntimeAsyncClient bedrockAsyncClient;

    private final ObjectMapper mapper = new ObjectMapper();

    // ─────────────────────────────────────────────────────────────────────────
    // Text-to-Speech
    // ─────────────────────────────────────────────────────────────────────────

    public String textToSpeech(String text) {
        log.info("Nova Sonic TTS: {} chars", text.length());

        String promptName  = UUID.randomUUID().toString();
        String contentName = UUID.randomUUID().toString();
        StringBuilder audioB64 = new StringBuilder();
        CountDownLatch latch = new CountDownLatch(1);

        try {
            // Build all input events up-front
            List<InvokeModelWithBidirectionalStreamInput> events = Arrays.asList(
                evt(sessionStart()),
                evt(ttsPromptStart(promptName)),
                evt(textContentStart(promptName, contentName)),
                evt(textInput(promptName, contentName, text)),
                evt(contentEnd(promptName, contentName)),
                evt(promptEnd(promptName))
            );

            InvokeModelWithBidirectionalStreamResponseHandler handler =
                InvokeModelWithBidirectionalStreamResponseHandler.builder()
                    .subscriber(
                        InvokeModelWithBidirectionalStreamResponseHandler.Visitor.builder()
                            .onChunk(chunk -> parseTtsChunk(chunk, audioB64, latch))
                            .onDefault(event -> {
                                // Nova Sonic response events arrive as UNKNOWN_TO_SDK_VERSION
                                // DefaultChunk extends BidirectionalOutputPayloadPart which has bytes()
                                if (event instanceof BidirectionalOutputPayloadPart part) {
                                    parseTtsChunk(part, audioB64, latch);
                                } else {
                                    log.debug("TTS unknown event type: {}", event.getClass().getSimpleName());
                                }
                            })
                            .build())
                    .onError(e -> {
                        log.error("Nova Sonic TTS stream error: {}", e.getMessage());
                        latch.countDown();
                    })
                    .onComplete(latch::countDown)
                    .build();

            // SyncListPublisher delivers items only after the subscriber attaches —
            // no race condition, no dropped events.
            CompletableFuture<Void> future = bedrockAsyncClient.invokeModelWithBidirectionalStream(
                InvokeModelWithBidirectionalStreamRequest.builder()
                    .modelId(NOVA_SONIC_MODEL_ID)
                    .build(),
                new SyncListPublisher<>(events),
                handler);

            boolean completed = latch.await(STREAM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!completed) {
                log.warn("Nova Sonic TTS timed out after {}s", STREAM_TIMEOUT_SECONDS);
            }
            future.cancel(false);

            log.info("Nova Sonic TTS done, audio B64 length: {}", audioB64.length());
            return audioB64.toString();

        } catch (Exception e) {
            log.error("Nova Sonic TTS failed: {}", e.getMessage());
            return "";
        }
    }

    private void parseTtsChunk(BidirectionalOutputPayloadPart chunk,
                                StringBuilder audioB64,
                                CountDownLatch latch) {
        try {
            String raw = chunk.bytes().asUtf8String();
            log.debug("TTS chunk: {}", raw.length() > 200 ? raw.substring(0, 200) + "…" : raw);

            JsonNode event = mapper.readTree(raw).path("event");

            if (event.has("audioOutput")) {
                String audio = event.path("audioOutput").path("content").asText("");
                if (!audio.isEmpty()) {
                    audioB64.append(audio);
                    log.info("TTS audio chunk: {} B64 chars (total: {})", audio.length(), audioB64.length());
                }
            } else if (event.has("completionEnd")) {
                log.info("TTS completionEnd — stream finished");
                latch.countDown();
            }
        } catch (Exception e) {
            log.error("TTS chunk parse error: {}", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Speech-to-Text
    // ─────────────────────────────────────────────────────────────────────────

    public String speechToText(byte[] audioBytes) {
        log.info("Nova Sonic STT: {} audio bytes", audioBytes.length);

        String promptName  = UUID.randomUUID().toString();
        String contentName = UUID.randomUUID().toString();
        AtomicReference<StringBuilder> transcript = new AtomicReference<>(new StringBuilder());
        CountDownLatch latch = new CountDownLatch(1);

        try {
            List<InvokeModelWithBidirectionalStreamInput> events = new ArrayList<>();
            events.add(evt(sessionStart()));
            events.add(evt(sttPromptStart(promptName)));
            events.add(evt(audioContentStart(promptName, contentName)));

            // Chunk audio in 16 KB pieces
            int chunkSize = 16384;
            for (int off = 0; off < audioBytes.length; off += chunkSize) {
                byte[] slice = Arrays.copyOfRange(audioBytes, off,
                    Math.min(off + chunkSize, audioBytes.length));
                events.add(evt(audioInput(promptName, contentName, slice)));
            }

            events.add(evt(contentEnd(promptName, contentName)));
            events.add(evt(promptEnd(promptName)));

            InvokeModelWithBidirectionalStreamResponseHandler handler =
                InvokeModelWithBidirectionalStreamResponseHandler.builder()
                    .subscriber(
                        InvokeModelWithBidirectionalStreamResponseHandler.Visitor.builder()
                            .onChunk(chunk -> parseSttChunk(chunk, transcript, latch))
                            .onDefault(event -> {
                                if (event instanceof BidirectionalOutputPayloadPart part) {
                                    parseSttChunk(part, transcript, latch);
                                }
                            })
                            .build())
                    .onError(e -> {
                        log.error("Nova Sonic STT stream error: {}", e.getMessage());
                        latch.countDown();
                    })
                    .onComplete(latch::countDown)
                    .build();

            CompletableFuture<Void> future = bedrockAsyncClient.invokeModelWithBidirectionalStream(
                InvokeModelWithBidirectionalStreamRequest.builder()
                    .modelId(NOVA_SONIC_MODEL_ID)
                    .build(),
                new SyncListPublisher<>(events),
                handler);

            boolean completed = latch.await(STREAM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!completed) log.warn("Nova Sonic STT timed out after {}s", STREAM_TIMEOUT_SECONDS);
            future.cancel(false);

            String result = transcript.get().toString().trim();
            log.info("STT transcript: '{}'", result);
            return result.isEmpty() ? "[Could not transcribe audio]" : result;

        } catch (Exception e) {
            log.error("Nova Sonic STT failed: {}", e.getMessage());
            return "[Transcription error: " + e.getMessage() + "]";
        }
    }

    private void parseSttChunk(BidirectionalOutputPayloadPart chunk,
                                AtomicReference<StringBuilder> transcript,
                                CountDownLatch latch) {
        try {
            JsonNode event = mapper.readTree(chunk.bytes().asUtf8String()).path("event");
            if (event.has("textOutput")) {
                transcript.get().append(event.path("textOutput").path("content").asText(""));
            } else if (event.has("completionEnd")) {
                latch.countDown();
            }
        } catch (Exception e) {
            log.debug("STT chunk parse error: {}", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Event builders — Nova Sonic JSON protocol
    // ─────────────────────────────────────────────────────────────────────────

    private InvokeModelWithBidirectionalStreamInput evt(String json) {
        return BidirectionalInputPayloadPart.builder()
            .bytes(SdkBytes.fromUtf8String(json))
            .build();
    }

    /** sessionStart — NO promptName; just inferenceConfiguration */
    private String sessionStart() throws Exception {
        ObjectNode cfg = mapper.createObjectNode();
        cfg.put("maxTokens", 1024);
        cfg.put("topP", 0.9);
        cfg.put("temperature", 0.7);
        ObjectNode body = mapper.createObjectNode();
        body.set("inferenceConfiguration", cfg);
        return envelope("sessionStart", body);
    }

    /** promptStart for TTS — requests audioOutput from Nova Sonic */
    private String ttsPromptStart(String promptName) throws Exception {
        ObjectNode textOut = mapper.createObjectNode();
        textOut.put("mediaType", "text/plain");

        ObjectNode audioOut = mapper.createObjectNode();
        audioOut.put("mediaType", "audio/lpcm");
        audioOut.put("sampleRateHertz", 24000);
        audioOut.put("sampleSizeBits", 16);
        audioOut.put("channelCount", 1);
        audioOut.put("voiceId", "matthew");
        audioOut.put("encoding", "base64");
        audioOut.put("audioType", "SPEECH");

        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        body.set("textOutputConfiguration", textOut);
        body.set("audioOutputConfiguration", audioOut);
        return envelope("promptStart", body);
    }

    /** promptStart for STT — requests textOutput (transcript) */
    private String sttPromptStart(String promptName) throws Exception {
        ObjectNode textOut = mapper.createObjectNode();
        textOut.put("mediaType", "text/plain");
        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        body.set("textOutputConfiguration", textOut);
        return envelope("promptStart", body);
    }

    /** contentStart for a TEXT content block (user text input for TTS) */
    private String textContentStart(String promptName, String contentName) throws Exception {
        ObjectNode textIn = mapper.createObjectNode();
        textIn.put("mediaType", "text/plain");
        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        body.put("contentName", contentName);
        body.put("type", "TEXT");
        body.put("interactive", false);
        body.put("role", "USER");
        body.set("textInputConfiguration", textIn);
        return envelope("contentStart", body);
    }

    /** contentStart for an AUDIO content block (user audio input for STT) */
    private String audioContentStart(String promptName, String contentName) throws Exception {
        ObjectNode audioIn = mapper.createObjectNode();
        audioIn.put("mediaType", "audio/lpcm");
        audioIn.put("sampleRateHertz", 16000);
        audioIn.put("sampleSizeBits", 16);
        audioIn.put("channelCount", 1);
        audioIn.put("audioType", "SPEECH");
        audioIn.put("encoding", "base64");
        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        body.put("contentName", contentName);
        body.put("type", "AUDIO");
        body.put("interactive", true);
        body.put("role", "USER");
        body.set("audioInputConfiguration", audioIn);
        return envelope("contentStart", body);
    }

    /** textInput — the text payload to speak */
    private String textInput(String promptName, String contentName, String text) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        body.put("contentName", contentName);
        body.put("content", text);
        return envelope("textInput", body);
    }

    /** audioInput — one base64-encoded LPCM audio chunk */
    private String audioInput(String promptName, String contentName, byte[] chunk) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        body.put("contentName", contentName);
        body.put("content", Base64.getEncoder().encodeToString(chunk));
        return envelope("audioInput", body);
    }

    /** contentEnd — closes the content block */
    private String contentEnd(String promptName, String contentName) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        body.put("contentName", contentName);
        body.put("stopReason", "END_TURN");
        return envelope("contentEnd", body);
    }

    /** promptEnd — triggers Nova Sonic to generate its response */
    private String promptEnd(String promptName) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("promptName", promptName);
        return envelope("promptEnd", body);
    }

    private String envelope(String type, ObjectNode payload) throws Exception {
        ObjectNode event = mapper.createObjectNode();
        event.set(type, payload);
        ObjectNode root = mapper.createObjectNode();
        root.set("event", event);
        return mapper.writeValueAsString(root);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SyncListPublisher — delivers items when subscriber requests, no race condition
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * A spec-compliant org.reactivestreams.Publisher backed by a fixed List.
     * Items are delivered synchronously when the subscriber calls request(n),
     * ensuring they are sent AFTER the HTTP/2 stream subscription is established.
     *
     * This avoids the SubmissionPublisher race condition where submitted items
     * are dropped because close() is called before the async subscriber attaches.
     */
    static class SyncListPublisher<T> implements Publisher<T> {
        private final List<T> items;

        SyncListPublisher(List<T> items) {
            this.items = List.copyOf(items);
        }

        @Override
        public void subscribe(Subscriber<? super T> subscriber) {
            subscriber.onSubscribe(new Subscription() {
                private final AtomicInteger cursor = new AtomicInteger(0);
                private final AtomicBoolean cancelled = new AtomicBoolean(false);

                @Override
                public void request(long n) {
                    if (cancelled.get() || n <= 0) return;
                    try {
                        long remaining = n;
                        while (remaining-- > 0 && !cancelled.get()) {
                            int i = cursor.getAndIncrement();
                            if (i < items.size()) {
                                subscriber.onNext(items.get(i));
                            } else {
                                subscriber.onComplete();
                                return;
                            }
                        }
                        // If we exhausted items within this request batch, complete
                        if (cursor.get() >= items.size()) {
                            subscriber.onComplete();
                        }
                    } catch (Exception e) {
                        subscriber.onError(e);
                    }
                }

                @Override
                public void cancel() {
                    cancelled.set(true);
                }
            });
        }
    }
}
