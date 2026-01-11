import { useEffect, useRef } from "react";
import { View, Text, Animated, Dimensions } from "react-native";

interface SuccessCelebrationProps {
  visible: boolean;
  message?: string;
  onComplete?: () => void;
}

const { width, height } = Dimensions.get("window");

const CONFETTI_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#3b82f6"];
const NUM_PARTICLES = 30;

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
  startX: number;
  endX: number;
}

export function SuccessCelebration({
  visible,
  message = "Success!",
  onComplete,
}: SuccessCelebrationProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const particles = useRef<Particle[]>(
    Array.from({ length: NUM_PARTICLES }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotation: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      startX: width / 2 - 50 + Math.random() * 100,
      endX: Math.random() * width,
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      checkmarkScale.setValue(0);

      // Main celebration animation
      Animated.sequence([
        // Fade in and scale up
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        // Pop the checkmark
        Animated.spring(checkmarkScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 5,
        }),
      ]).start();

      // Confetti particles animation
      particles.forEach((particle, index) => {
        particle.x.setValue(particle.startX);
        particle.y.setValue(height / 2);
        particle.rotation.setValue(0);
        particle.scale.setValue(0);
        particle.opacity.setValue(1);

        const delay = index * 30;
        const duration = 1500 + Math.random() * 500;

        setTimeout(() => {
          Animated.parallel([
            Animated.timing(particle.x, {
              toValue: particle.endX,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(particle.y, {
              toValue: height + 50,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(particle.rotation, {
              toValue: 360 * (2 + Math.random() * 2),
              duration,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.spring(particle.scale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
              }),
              Animated.timing(particle.scale, {
                toValue: 0.5,
                duration: duration - 300,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration,
              delay: duration * 0.7,
              useNativeDriver: true,
            }),
          ]).start();
        }, delay);
      });

      // Auto dismiss after animation
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onComplete?.());
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      style={{ zIndex: 1001 }}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      {/* Confetti particles */}
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? 5 : 0,
            transform: [
              { translateX: particle.x },
              { translateY: particle.y },
              {
                rotate: particle.rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ["0deg", "360deg"],
                }),
              },
              { scale: particle.scale },
            ],
            opacity: particle.opacity,
          }}
        />
      ))}

      {/* Main celebration badge */}
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
        className="bg-surface rounded-2xl p-8 items-center shadow-xl"
      >
        <Animated.View
          style={{
            transform: [{ scale: checkmarkScale }],
          }}
          className="w-20 h-20 rounded-full bg-success items-center justify-center mb-4"
        >
          <Text className="text-white text-4xl">✓</Text>
        </Animated.View>
        <Text className="text-text-primary text-xl font-bold">{message}</Text>
      </Animated.View>
    </View>
  );
}
