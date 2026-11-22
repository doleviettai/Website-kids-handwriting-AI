package com.example.backend.entity.value;

/** t is optional for reference templates; TOUCH submissions carry timestamps. */
public record StrokePoint(double x, double y, Long t) { }
