package com.example.backend.service;

import com.example.backend.dto.AiDtos.*;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import java.math.BigDecimal;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class SubmissionService {
    private final AiClient ai;
    private final SubmissionPersistence persistence;
    private final SubmissionRepository submissions;
    private final UserRepository users;
    private final SubmissionErrorRepository errors;

    public long submit(long parentId,SubmitRequest input) {
        validate(input);
        var prepared=persistence.prepare(parentId,input);
        AiResult result=ai.analyze(prepared.request());
        validateResult(prepared,result);
        return persistence.save(parentId,input,prepared,result);
    }

    public RecognitionResult preview(long parentId, SubmitRequest input) {
        validate(input);
        var request = persistence.prepare(parentId, input).request();
        if (input.wordEnds() != null && !input.wordEnds().isEmpty()) throw invalid("Nhận dạng thử chỉ nhận một chữ hoặc một từ đang viết.");
        var result = ai.recognize(new RecognitionRequest(request.task(), request.modelVersion(), request.width(), request.height(), request.strokes()));
        if (result == null || result.text() == null || result.text().length() > 500 || result.confidence() == null || !ratio(result.confidence())) throw invalidAi();
        return result;
    }

    private void validate(SubmitRequest input) {
        long previous=-1;int points=0;
        for(var stroke:input.strokes()) {
            if(stroke==null || stroke.isEmpty()) throw invalid("Nét viết không được rỗng.");
            points+=stroke.size();if(points>20000) throw invalid("Bài viết vượt 20.000 điểm. Bé chia nhỏ bài rồi thử lại nhé.");
            for(var p:stroke) {
                if(p==null||!Double.isFinite(p.x())||!Double.isFinite(p.y())||p.x()<0||p.y()<0||p.x()>input.width()||p.y()>input.height()
                        ||p.t()==null||p.t()<previous) throw invalid("Tọa độ hoặc thời gian nét viết chưa hợp lệ.");
                previous=p.t();
            }
        }
        int last=0;
        if(input.wordEnds()!=null&&!input.wordEnds().isEmpty()) {
            for(Integer end:input.wordEnds()) {if(end==null||end<=last||end>input.strokes().size()) throw invalid("Mốc tách từ chưa hợp lệ.");last=end;}
            if(last!=input.strokes().size()) throw invalid("Mốc tách từ cần bao gồm toàn bộ nét.");
        }
    }
    private void validateResult(SubmissionPersistence.Prepared prepared,AiResult result) {
        if(result==null||result.task()!=prepared.request().task()||!Objects.equals(result.modelVersion(),prepared.request().modelVersion())
                ||!Objects.equals(result.modelPath(),prepared.modelPath())||result.predictedText()==null||result.predictedText().length()>500
                ||result.confidence()==null||result.textAccuracy()==null||!ratio(result.confidence())||!ratio(result.textAccuracy())
                ||result.errors()==null||result.errors().size()>220||result.segments()==null||result.segments().size()>100)
            throw invalidAi();
        for(Byte score:Arrays.asList(result.shapeScore(),result.similarityScore(),result.directionScore(),result.strokeOrderScore()))
            if(score!=null&&(score<0||score>100)) throw invalidAi();
        for(Finding error:result.errors()) if(error==null||error.code()==null||error.segmentIndex()!=null&&(error.segmentIndex()<0||error.segmentIndex()>126)
                ||error.strokeIndex()!=null&&(error.strokeIndex()<0||error.strokeIndex()>99)) throw invalidAi();
    }
    private boolean ratio(BigDecimal value) {return value.compareTo(BigDecimal.ZERO)>=0&&value.compareTo(BigDecimal.ONE)<=0;}
    private ApiException invalidAi() {return new ApiException(HttpStatus.BAD_GATEWAY,"Kết quả model không hợp lệ. Bài chưa được lưu; nhờ admin kiểm tra dịch vụ AI.");}
    private ApiException invalid(String text) {return new ApiException(HttpStatus.BAD_REQUEST,text);}

    @Transactional(readOnly=true)
    public SubmissionDetail detail(long userId,long id) {
        User user=users.findById(userId).orElseThrow(()->new ApiException(HttpStatus.UNAUTHORIZED,"Tài khoản không còn tồn tại."));
        Submission s=(user.getRole()==UserRole.ADMIN?submissions.findById(id):submissions.findByIdAndStudent_Parent_Id(id,userId))
                .orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Không tìm thấy bài viết trong phạm vi tài khoản."));
        var findings=errors.findBySubmission_Id(id).stream().map(e->new ErrorResponse(e.getErrorType().getCode(),e.getErrorType().getNameVi(),
                e.getErrorType().getFeedbackTemplateVi(),e.getSegmentIndex()==null?null:e.getSegmentIndex().intValue(),e.getStrokeIndex()==null?null:e.getStrokeIndex().intValue())).toList();
        return new SubmissionDetail(s.getId(),s.getStudent().getId(),s.getStudent().getNickname(),s.getItem().getId(),
                s.getItem().getLesson()==null?null:s.getItem().getLesson().getId(),s.getItem().getTextValue(),s.getPredictedText(),s.getSource(),
                s.getModel()==null?null:s.getModel().getName(),s.getModel()==null?null:s.getModel().getVersion(),s.getConfidence(),s.getTextAccuracy(),s.getIsCorrect(),
                s.getShapeScore(),s.getSimilarityScore(),s.getDirectionScore(),s.getStrokeOrderScore(),s.getTotalScore(),s.getStars(),s.getFeedbackText(),
                s.getShapeScore()==null&&s.getSimilarityScore()==null?"TEXT_ACCURACY":"REFERENCE_GEOMETRY",s.getStrokeData(),
                s.getSegmentsJson()==null?List.of():s.getSegmentsJson(),findings,s.getCreatedAt(),s.getItem().getItemType().modelTask());
    }
}
