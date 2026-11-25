package com.example.backend;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.example.backend.dto.AiDtos.*;
import com.example.backend.entity.*;
import com.example.backend.entity.enums.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

/** Boundary tests inject an explicit test double; application runtime always uses real HTTP AI. */
@SpringBootTest(properties="debug=false") @Transactional
class SubmissionApiTests {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired StudentRepository students;
    @Autowired WritingItemRepository items;
    @Autowired SubmissionRepository submissions;
    @Autowired StudentProgressRepository progress;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;
    @MockitoBean AiClient ai;
    MockMvc mvc;User parent;Student child;WritingItem item;String token;
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        parent=new User();parent.setEmail("submit-"+UUID.randomUUID()+"@example.test");parent.setPasswordHash("test-only");users.saveAndFlush(parent);
        child=new Student();child.setNickname("Bé thử");child.setParent(parent);child.setGradeLevel(GradeLevel.MAU_GIAO);students.saveAndFlush(child);
        item=items.findByItemTypeAndTextValue(ItemType.LETTER,"o").orElseThrow();token="Bearer "+jwt.issue(parent);
    }
    @Test void savesResultErrorsAndProgressAndProtectsDetails() throws Exception {
        when(ai.analyze(any())).thenReturn(result("a",new BigDecimal("0.2"),List.of(new Finding("WRONG_TEXT",null,null))));
        String body=mvc.perform(post("/api/submissions").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(payload()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.predictedText").value("a"))
                .andExpect(jsonPath("$.errors[0].code").value("WRONG_TEXT")).andExpect(jsonPath("$.totalScore").value(20))
                .andReturn().getResponse().getContentAsString();
        long id=json.readTree(body).get("id").asLong();
        assertThat(progress.findById(new StudentProgressId(child.getId(),item.getId())).orElseThrow().getAttempts()).isEqualTo(1);
        mvc.perform(get("/api/students/"+child.getId()+"/attention").header("Authorization",token)).andExpect(status().isOk()).andExpect(jsonPath("$[0].occurrences").value(1));
        User other=new User();other.setEmail("other-"+UUID.randomUUID()+"@example.test");other.setPasswordHash("test-only");users.saveAndFlush(other);
        mvc.perform(get("/api/submissions/"+id).header("Authorization","Bearer "+jwt.issue(other))).andExpect(status().isNotFound());
        User admin=users.findAll().stream().filter(u->u.getRole()==UserRole.ADMIN).findFirst().orElseThrow();
        mvc.perform(get("/api/admin/reviews").header("Authorization","Bearer "+jwt.issue(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isNotEmpty());
        mvc.perform(get("/api/submissions/"+id).header("Authorization","Bearer "+jwt.issue(admin))).andExpect(status().isOk());
    }
    @Test void unavailableAiDoesNotSaveAttemptOrProgress() throws Exception {
        long count=submissions.count();
        when(ai.analyze(any())).thenThrow(new com.example.backend.exception.ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"AI chưa sẵn sàng"));
        mvc.perform(post("/api/submissions").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isServiceUnavailable());
        assertThat(submissions.count()).isEqualTo(count);assertThat(progress.findById(new StudentProgressId(child.getId(),item.getId()))).isEmpty();
    }
    @Test void previewUsesOwnershipAndDoesNotCreateAttempt() throws Exception {
        long before = submissions.count();
        when(ai.recognize(any())).thenReturn(new RecognitionResult("o",new BigDecimal("0.8"),false,List.of(),List.of(),"",null));
        mvc.perform(post("/api/recognition/preview").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(payload()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.text").value("o"));
        assertThat(submissions.count()).isEqualTo(before);
        assertThat(progress.findById(new StudentProgressId(child.getId(),item.getId()))).isEmpty();
        User other=new User();other.setEmail("preview-"+UUID.randomUUID()+"@example.test");other.setPasswordHash("test-only");users.saveAndFlush(other);
        mvc.perform(post("/api/recognition/preview").header("Authorization","Bearer "+jwt.issue(other)).contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isNotFound());
        verify(ai,times(1)).recognize(any());
    }
    @Test void wrongOwnerAndInvalidPointsNeverReachModel() throws Exception {
        User other=new User();other.setEmail("foreign-"+UUID.randomUUID()+"@example.test");other.setPasswordHash("test-only");users.saveAndFlush(other);
        mvc.perform(post("/api/submissions").header("Authorization","Bearer "+jwt.issue(other)).contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isNotFound());
        String malformed=payload().replace("\"width\":900","\"width\":1");
        mvc.perform(post("/api/submissions").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(malformed)).andExpect(status().isBadRequest());
        verifyNoInteractions(ai);
    }
    @Test void recognitionOnlyNeverMarksHandwritingMasteredAndMalformedResultsFailClosed() throws Exception {
        when(ai.analyze(any())).thenReturn(result("o",BigDecimal.ONE,List.of()));
        for(int i=0;i<3;i++) mvc.perform(post("/api/submissions").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isCreated());
        var p=progress.findById(new StudentProgressId(child.getId(),item.getId())).orElseThrow();
        assertThat(p.getAttempts()).isEqualTo(3);assertThat(p.getIsMastered()).isFalse();
        when(ai.analyze(any())).thenReturn(new AiResult(ModelTask.COMPOUND,"v1","wrong", "o",BigDecimal.ONE,BigDecimal.ONE,null,null,null,null,List.of(),List.of(),"TEXT_ACCURACY"));
        mvc.perform(post("/api/submissions").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(payload())).andExpect(status().isBadGateway());
        assertThat(p.getAttempts()).isEqualTo(3);
    }
    private AiResult result(String text,BigDecimal accuracy,List<Finding> errors) {
        return new AiResult(ModelTask.SINGLE_CHAR,"v1","model/don/best.keras",text,new BigDecimal("0.7"),accuracy,null,null,null,null,List.of(),errors,"TEXT_ACCURACY");
    }
    private String payload() throws Exception {
        return json.writeValueAsString(Map.of("studentId",child.getId(),"itemId",item.getId(),"width",900,"height",420,
                "strokes",List.of(List.of(Map.of("x",10,"y",20,"t",1000),Map.of("x",30,"y",40,"t",1010))),"wordEnds",List.of()));
    }
}
