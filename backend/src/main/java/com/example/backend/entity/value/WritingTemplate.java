package com.example.backend.entity.value;

import java.util.List;

public record WritingTemplate(int width, int height, List<List<StrokePoint>> strokes) { }
