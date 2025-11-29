import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

export const Confetti = ({ visible = true, duration = 3000 }) => {
    const confettiPieces = useRef(
        Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: new Animated.Value(Math.random() * SCREEN_WIDTH),
            y: new Animated.Value(-20),
            rotation: new Animated.Value(0),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            size: Math.random() * 10 + 8,
            speed: Math.random() * 3000 + 2000,
        }))
    ).current;

    useEffect(() => {
        if (!visible) return;

        const animations = confettiPieces.map((piece) => {
            const randomX = Math.random() * SCREEN_WIDTH * 0.8 + SCREEN_WIDTH * 0.1;
            const randomRotation = Math.random() * 720 - 360;

            return Animated.parallel([
                Animated.timing(piece.y, {
                    toValue: SCREEN_HEIGHT + 100,
                    duration: piece.speed,
                    useNativeDriver: true,
                }),
                Animated.timing(piece.x, {
                    toValue: randomX,
                    duration: piece.speed,
                    useNativeDriver: true,
                }),
                Animated.timing(piece.rotation, {
                    toValue: randomRotation,
                    duration: piece.speed,
                    useNativeDriver: true,
                }),
            ]);
        });

        Animated.parallel(animations).start();
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {confettiPieces.map((piece) => {
                const rotationInterpolate = piece.rotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                });

                return (
                    <Animated.View
                        key={piece.id}
                        style={[
                            styles.confettiPiece,
                            {
                                backgroundColor: piece.color,
                                width: piece.size,
                                height: piece.size,
                                transform: [
                                    { translateX: piece.x },
                                    { translateY: piece.y },
                                    { rotate: rotationInterpolate },
                                ],
                            },
                        ]}
                    />
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
    },
    confettiPiece: {
        position: 'absolute',
        borderRadius: 2,
    },
});

