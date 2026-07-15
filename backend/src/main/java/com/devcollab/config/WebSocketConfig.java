package com.devcollab.config;

import com.devcollab.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.*;

import java.util.List;

@Slf4j
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    /**
     * ChannelInterceptor: runs on every inbound STOMP frame.
     * On CONNECT: extracts JWT from Authorization header,
     * validates it, and sets the Principal so @MessageMapping
     * methods receive the authenticated user.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor == null) return message;

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    // Read JWT from STOMP connect headers
                    List<String> authHeaders = accessor.getNativeHeader("Authorization");
                    if (authHeaders == null || authHeaders.isEmpty()) {
                        log.warn("[WS] CONNECT received with no Authorization header");
                        return message;
                    }

                    String authHeader = authHeaders.get(0);
                    if (!authHeader.startsWith("Bearer ")) {
                        log.warn("[WS] CONNECT Authorization header malformed");
                        return message;
                    }

                    String token = authHeader.substring(7);
                    try {
                        String username = jwtUtil.extractUsername(token);
                        if (username != null && jwtUtil.validateToken(token, username)) {
                            UserDetails userDetails =
                                    userDetailsService.loadUserByUsername(username);
                            UsernamePasswordAuthenticationToken auth =
                                    new UsernamePasswordAuthenticationToken(
                                            userDetails, null, userDetails.getAuthorities());
                            accessor.setUser(auth);
                            log.info("[WS] CONNECT authenticated: {}", username);
                        } else {
                            log.warn("[WS] CONNECT JWT validation failed");
                        }
                    } catch (Exception e) {
                        log.error("[WS] CONNECT JWT error: {}", e.getMessage());
                    }
                }

                return message;
            }
        });
    }
}
