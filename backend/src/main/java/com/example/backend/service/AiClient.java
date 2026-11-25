package com.example.backend.service;

import com.example.backend.dto.AiDtos.*;
import java.util.Map;

public interface AiClient {
    AiResult analyze(AiRequest request);
    RecognitionResult recognize(RecognitionRequest request);
    Map<String,Object> status();
}
