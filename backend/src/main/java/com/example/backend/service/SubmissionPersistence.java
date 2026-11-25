package com.example.backend.service;

import com.example.backend.dto.AiDtos.*;
import com.example.backend.config.ScoringProperties;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.*;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.example.backend.util.VietnameseText;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class SubmissionPersistence {
    private final StudentRepository students;
    private final WritingItemRepository items;
    private final AiModelRepository models;
    private final SubmissionRepository submissions;
    private final SubmissionErrorRepository errors;
    private final ErrorTypeRepository errorTypes;
    private final StudentProgressRepository progress;
    private final ScoringProperties scoring;

    public record Prepared(AiRequest request,Integer modelId,String modelPath) { }
    @Transactional(readOnly=true)
    public Prepared prepare(long parentId,SubmitRequest input) {
        students.findByIdAndParent_Id(input.studentId(),parentId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Không tìm thấy hồ sơ của bé."));
        WritingItem item=items.findById(input.itemId()).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Không tìm thấy nội dung."));
        var active=models.findByTaskAndIsActiveTrueOrderByIdAsc(item.getItemType().modelTask());
        if(active.size()!=1 || active.getFirst().getModelPath()==null) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Model của nội dung chưa được cấu hình duy nhất. Nhờ quản trị viên kiểm tra.");
        AiModel model=active.getFirst();
        return new Prepared(new AiRequest(model.getTask(),item.getTextValue(),SubmissionSource.TOUCH,model.getVersion(),input.width(),input.height(),input.strokes(),input.wordEnds()==null?List.of():input.wordEnds(),item.getTemplateJson()),model.getId(),model.getModelPath());
    }

    @Transactional
    public long save(long parentId,SubmitRequest input,Prepared prepared,AiResult result) {
        Student student=students.lockOwned(input.studentId(),parentId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Hồ sơ không còn tồn tại."));
        WritingItem item=items.findById(input.itemId()).orElseThrow(()->new ApiException(HttpStatus.CONFLICT,"Nội dung vừa thay đổi. Ba mẹ tải lại bài học."));
        if(!item.getTextValue().equals(prepared.request().expectedText())||item.getItemType().modelTask()!=prepared.request().task()
                ||!Objects.equals(item.getTemplateJson(),prepared.request().template()))
            throw new ApiException(HttpStatus.CONFLICT,"Nội dung vừa thay đổi. Ba mẹ tải lại bài học rồi gửi lại.");
        Submission s=new Submission(); s.setStudent(student);s.setItem(item);s.setSource(SubmissionSource.TOUCH);
        s.setModel(models.findById(prepared.modelId()).orElseThrow());
        s.setStrokeData(input.strokes().stream().map(stroke->stroke.stream().map(p->new com.example.backend.entity.value.StrokePoint(p.x()*900/input.width(),p.y()*420/input.height(),p.t())).toList()).toList());
        s.setPredictedText(VietnameseText.nfc(result.predictedText()));s.setConfidence(result.confidence());s.setTextAccuracy(result.textAccuracy());
        s.setIsCorrect(prepared.request().task()==ModelTask.PARAGRAPH ? result.textAccuracy().compareTo(BigDecimal.ONE)==0 : item.getTextValue().equals(s.getPredictedText()));s.setShapeScore(result.shapeScore());s.setSimilarityScore(result.similarityScore());
        s.setDirectionScore(result.directionScore());s.setStrokeOrderScore(result.strokeOrderScore());s.setSegmentsJson(result.segments());
        double[] weights={scoring.getShape(),scoring.getSimilarity(),scoring.getDirection(),scoring.getStrokeOrder()};
        Byte[] components={s.getShapeScore(),s.getSimilarityScore(),s.getDirectionScore(),s.getStrokeOrderScore()};
        double weighted=0,totalWeight=0;
        for(int i=0;i<4;i++) if(components[i]!=null) { weighted+=weights[i]*components[i];totalWeight+=weights[i]; }
        double score=totalWeight==0?result.textAccuracy().doubleValue()*100:weighted/totalWeight;
        if(totalWeight>0) score*=result.textAccuracy().doubleValue();
        int total=(int)Math.round(Math.max(0,Math.min(100,score)));s.setTotalScore((byte)total);s.setStars((byte)(total>=90?3:total>=70?2:total>=50?1:0));
        List<ErrorType> types=new ArrayList<>();
        for(Finding finding:result.errors()) types.add(errorTypes.findByCode(finding.code()).orElseThrow(()->new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Mã phản hồi AI chưa có trong danh mục. Nhờ admin kiểm tra.")));
        s.setFeedbackText(types.isEmpty()?scoring.getPositiveFeedback():String.join(" ",types.stream().map(ErrorType::getFeedbackTemplateVi).distinct().toList()));
        submissions.saveAndFlush(s);
        Set<String> unique=new HashSet<>();
        for(int i=0;i<result.errors().size();i++) {
            Finding finding=result.errors().get(i);
            if(!unique.add(finding.code()+":"+finding.segmentIndex()+":"+finding.strokeIndex())) continue;
            SubmissionError error=new SubmissionError();error.setSubmission(s);error.setErrorType(types.get(i));
            error.setSegmentIndex(finding.segmentIndex()==null?null:finding.segmentIndex().byteValue());error.setStrokeIndex(finding.strokeIndex()==null?null:finding.strokeIndex().byteValue());errors.save(error);
        }
        var key=new StudentProgressId(student.getId(),item.getId());
        StudentProgress p=progress.findById(key).orElseGet(()->{var row=new StudentProgress();row.setId(key);row.setStudent(student);row.setItem(item);return row;});
        p.setAttempts((p.getAttempts()==null?0:p.getAttempts())+1);p.setLastScore((byte)total);p.setBestScore((byte)Math.max(p.getBestScore()==null?0:p.getBestScore(),total));
        p.setLastAttemptAt(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        // Recognition-only scores do not establish handwriting mastery.
        p.setIsMastered(Boolean.TRUE.equals(p.getIsMastered()) || (totalWeight>0 && total>=80 && p.getAttempts()>=3 && result.confidence().compareTo(new BigDecimal("0.65"))>=0 && s.getIsCorrect()));
        progress.save(p);return s.getId();
    }
}
