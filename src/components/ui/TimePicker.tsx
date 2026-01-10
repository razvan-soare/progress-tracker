import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Button } from "./Button";

interface TimePickerProps {
  value: string; // Format: "HH:MM" (24-hour)
  onChange: (time: string) => void;
  visible: boolean;
  onClose: () => void;
}

function generateHours(): string[] {
  const hours: string[] = [];
  for (let i = 0; i < 24; i++) {
    hours.push(i.toString().padStart(2, "0"));
  }
  return hours;
}

function generateMinutes(): string[] {
  const minutes: string[] = [];
  for (let i = 0; i < 60; i += 5) {
    minutes.push(i.toString().padStart(2, "0"));
  }
  return minutes;
}

function formatTimeForDisplay(hour: string, minute: string): string {
  const h = parseInt(hour, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${minute} ${period}`;
}

export function TimePicker({
  value,
  onChange,
  visible,
  onClose,
}: TimePickerProps) {
  const [hour, minute] = value.split(":");
  const [selectedHour, setSelectedHour] = useState(hour || "20");
  const [selectedMinute, setSelectedMinute] = useState(minute || "00");

  const hours = useMemo(() => generateHours(), []);
  const minutes = useMemo(() => generateMinutes(), []);

  const handleConfirm = useCallback(() => {
    onChange(`${selectedHour}:${selectedMinute}`);
    onClose();
  }, [selectedHour, selectedMinute, onChange, onClose]);

  const handleCancel = useCallback(() => {
    // Reset to original value
    const [h, m] = value.split(":");
    setSelectedHour(h || "20");
    setSelectedMinute(m || "00");
    onClose();
  }, [value, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-center items-center px-4"
        onPress={handleCancel}
      >
        <Pressable
          className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="py-4 px-4 border-b border-border">
            <Text className="text-text-primary text-lg font-semibold text-center">
              Select Time
            </Text>
          </View>

          {/* Time Selection */}
          <View className="flex-row py-4 px-2">
            {/* Hour Column */}
            <View className="flex-1 mx-1">
              <Text className="text-text-secondary text-xs text-center mb-2">
                Hour
              </Text>
              <ScrollView
                className="max-h-40"
                showsVerticalScrollIndicator={false}
              >
                {hours.map((h) => {
                  const isSelected = h === selectedHour;
                  return (
                    <TouchableOpacity
                      key={h}
                      onPress={() => setSelectedHour(h)}
                      className={`py-2 px-2 rounded-lg mb-1 ${
                        isSelected ? "bg-primary" : ""
                      }`}
                    >
                      <Text
                        className={`text-center text-sm ${
                          isSelected ? "text-white font-semibold" : "text-text-primary"
                        }`}
                      >
                        {h}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Separator */}
            <View className="items-center justify-center px-1">
              <Text className="text-text-primary text-2xl font-bold">:</Text>
            </View>

            {/* Minute Column */}
            <View className="flex-1 mx-1">
              <Text className="text-text-secondary text-xs text-center mb-2">
                Minute
              </Text>
              <ScrollView
                className="max-h-40"
                showsVerticalScrollIndicator={false}
              >
                {minutes.map((m) => {
                  const isSelected = m === selectedMinute;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setSelectedMinute(m)}
                      className={`py-2 px-2 rounded-lg mb-1 ${
                        isSelected ? "bg-primary" : ""
                      }`}
                    >
                      <Text
                        className={`text-center text-sm ${
                          isSelected ? "text-white font-semibold" : "text-text-primary"
                        }`}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Selected Time Preview */}
          <View className="py-2 px-4 bg-background/50">
            <Text className="text-text-primary text-center text-lg">
              {formatTimeForDisplay(selectedHour, selectedMinute)}
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="flex-row p-4 border-t border-border">
            <View className="flex-1 mr-2">
              <Button title="Cancel" variant="secondary" onPress={handleCancel} />
            </View>
            <View className="flex-1 ml-2">
              <Button title="Confirm" variant="primary" onPress={handleConfirm} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
