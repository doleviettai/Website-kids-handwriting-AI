package com.example.backend.entity.enums;

public enum ItemType {
    LETTER, DIGIT, DIGRAPH, WORD, SENTENCE;

    public ModelTask modelTask() {
        return switch (this) {
            case LETTER, DIGIT -> ModelTask.SINGLE_CHAR;
            case DIGRAPH -> ModelTask.COMPOUND;
            case WORD, SENTENCE -> ModelTask.PARAGRAPH;
        };
    }
}
