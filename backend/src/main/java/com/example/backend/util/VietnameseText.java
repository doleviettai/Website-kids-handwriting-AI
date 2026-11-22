package com.example.backend.util;

import java.text.Normalizer;

public final class VietnameseText {
    private VietnameseText() { }

    public static String nfc(String text) {
        return text == null ? null : Normalizer.normalize(text, Normalizer.Form.NFC);
    }
}
