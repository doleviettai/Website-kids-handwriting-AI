package com.example.backend.service;

import com.example.backend.dto.AiDtos.*;
import com.example.backend.exception.ApiException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class HttpAiClient implements AiClient {
    private final ObjectMapper json;
    private final String baseUrl;
    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(5)).build();
    public HttpAiClient(ObjectMapper json,@Value("${app.ai.base-url:http://127.0.0.1:8000}") String url) {
        this.json=json; this.baseUrl=url.replaceAll("/+$", "");
    }
    @Override public AiResult analyze(AiRequest request) {
        return post("/analyze", request, AiResult.class);
    }
    @Override public RecognitionResult recognize(RecognitionRequest request) {
        return post("/recognize", request, RecognitionResult.class);
    }
    private <T> T post(String path, Object request, Class<T> resultType) {
        try {
            var call=HttpRequest.newBuilder(URI.create(baseUrl+path)).timeout(Duration.ofSeconds(90))
                    .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(request))).build();
            var result=client.send(call,HttpResponse.BodyHandlers.ofString());
            if(result.statusCode()==422) throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,"Model chưa đọc được nét viết. Bé viết rõ từng chữ/từ, tránh chỉ chấm một điểm, rồi thử lại nhé.");
            if(result.statusCode()!=200) throw unavailable();
            return json.readValue(result.body(),resultType);
        } catch(ApiException e) { throw e; }
        catch(InterruptedException e) { Thread.currentThread().interrupt(); throw unavailable(); }
        catch(Exception e) { throw unavailable(); }
    }
    @Override @SuppressWarnings("unchecked") public Map<String,Object> status() {
        try {
            var result=client.send(HttpRequest.newBuilder(URI.create(baseUrl+"/health")).timeout(Duration.ofSeconds(5)).GET().build(),HttpResponse.BodyHandlers.ofString());
            if(result.statusCode()!=200) throw unavailable();
            return json.readValue(result.body(),Map.class);
        } catch(Exception e) { return Map.of("status","DOWN","message","Chưa kết nối được FastAPI. Khởi động ai-server rồi thử lại.","models",Map.of()); }
    }
    private ApiException unavailable() { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Dịch vụ nhận dạng chưa sẵn sàng. Bài chưa được lưu hoặc chấm; ba mẹ kiểm tra ai-server rồi thử lại."); }
}
