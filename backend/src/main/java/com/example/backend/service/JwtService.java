package com.example.backend.service;

import com.example.backend.entity.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    public static final long TTL_SECONDS = 3600;
    private final JwtEncoder encoder;
    private final NimbusJwtDecoder decoder;
    // An allowlist makes logout immediate. Restarting the server requires signing in again.
    private final ConcurrentHashMap<String, Instant> sessions = new ConcurrentHashMap<>();

    public JwtService(@Value("${app.jwt.secret}") String encodedSecret) {
        byte[] secret;
        try { secret = Base64.getDecoder().decode(encodedSecret); }
        catch (IllegalArgumentException exception) { throw new IllegalStateException("JWT_SECRET phải là Base64 hợp lệ."); }
        if (secret.length < 32) throw new IllegalStateException("Cần JWT_SECRET ít nhất 32 byte, xem backend/README.md.");
        var key = new SecretKeySpec(secret, "HmacSHA256");
        encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> sessionValidator = token -> {
            Instant expiry = token.getId() == null ? null : sessions.get(token.getId());
            return expiry != null && expiry.isAfter(Instant.now())
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Phiên đăng nhập đã kết thúc.", null));
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer("netxinh"), sessionValidator));
    }

    public String issue(User user) {
        Instant now = Instant.now();
        sessions.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
        String id = UUID.randomUUID().toString();
        Instant expiry = now.plusSeconds(TTL_SECONDS);
        var claims = JwtClaimsSet.builder().issuer("netxinh").subject(user.getId().toString())
                .issuedAt(now).expiresAt(expiry).id(id).claim("role", user.getRole().name()).build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        sessions.put(id, expiry);
        return token;
    }

    public Jwt decode(String value) { return decoder.decode(value); }
    public void revoke(Jwt jwt) { sessions.remove(jwt.getId()); }
}
