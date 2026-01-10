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

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  visible: boolean;
  onClose: () => void;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function generateYears(min: number, max: number): number[] {
  const years: number[] = [];
  for (let i = max; i >= min; i--) {
    years.push(i);
  }
  return years;
}

export function DatePicker({
  value,
  onChange,
  maximumDate,
  minimumDate,
  visible,
  onClose,
}: DatePickerProps) {
  const [selectedYear, setSelectedYear] = useState(value.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(value.getMonth());
  const [selectedDay, setSelectedDay] = useState(value.getDate());

  const maxDate = maximumDate || new Date();
  const minDate = minimumDate || new Date(2000, 0, 1);

  const years = useMemo(
    () => generateYears(minDate.getFullYear(), maxDate.getFullYear()),
    [minDate, maxDate]
  );

  const availableMonths = useMemo(() => {
    if (selectedYear === maxDate.getFullYear()) {
      return MONTHS.slice(0, maxDate.getMonth() + 1);
    }
    if (selectedYear === minDate.getFullYear()) {
      return MONTHS.slice(minDate.getMonth());
    }
    return MONTHS;
  }, [selectedYear, maxDate, minDate]);

  const daysInMonth = useMemo(() => {
    const days = getDaysInMonth(selectedYear, selectedMonth);
    const result: number[] = [];

    let startDay = 1;
    let endDay = days;

    // If it's the max year and month, limit to max day
    if (
      selectedYear === maxDate.getFullYear() &&
      selectedMonth === maxDate.getMonth()
    ) {
      endDay = Math.min(days, maxDate.getDate());
    }

    // If it's the min year and month, start from min day
    if (
      selectedYear === minDate.getFullYear() &&
      selectedMonth === minDate.getMonth()
    ) {
      startDay = minDate.getDate();
    }

    for (let i = startDay; i <= endDay; i++) {
      result.push(i);
    }
    return result;
  }, [selectedYear, selectedMonth, maxDate, minDate]);

  const handleYearChange = useCallback(
    (year: number) => {
      setSelectedYear(year);
      // Adjust month if needed
      if (year === maxDate.getFullYear() && selectedMonth > maxDate.getMonth()) {
        setSelectedMonth(maxDate.getMonth());
      }
      if (year === minDate.getFullYear() && selectedMonth < minDate.getMonth()) {
        setSelectedMonth(minDate.getMonth());
      }
    },
    [maxDate, minDate, selectedMonth]
  );

  const handleMonthChange = useCallback(
    (monthIndex: number) => {
      // Adjust for available months offset
      let actualMonth = monthIndex;
      if (selectedYear === minDate.getFullYear()) {
        actualMonth = monthIndex + minDate.getMonth();
      }
      setSelectedMonth(actualMonth);
    },
    [selectedYear, minDate]
  );

  const handleConfirm = useCallback(() => {
    // Ensure day is valid for the selected month
    const maxDay = getDaysInMonth(selectedYear, selectedMonth);
    const validDay = Math.min(selectedDay, maxDay);

    // Ensure day is within bounds
    let finalDay = validDay;
    if (
      selectedYear === maxDate.getFullYear() &&
      selectedMonth === maxDate.getMonth()
    ) {
      finalDay = Math.min(finalDay, maxDate.getDate());
    }
    if (
      selectedYear === minDate.getFullYear() &&
      selectedMonth === minDate.getMonth()
    ) {
      finalDay = Math.max(finalDay, minDate.getDate());
    }

    const newDate = new Date(selectedYear, selectedMonth, finalDay);
    onChange(newDate);
    onClose();
  }, [selectedYear, selectedMonth, selectedDay, maxDate, minDate, onChange, onClose]);

  const handleCancel = useCallback(() => {
    // Reset to original value
    setSelectedYear(value.getFullYear());
    setSelectedMonth(value.getMonth());
    setSelectedDay(value.getDate());
    onClose();
  }, [value, onClose]);

  // Ensure selected day is valid when month/year changes
  const validDay = useMemo(() => {
    if (daysInMonth.includes(selectedDay)) {
      return selectedDay;
    }
    return daysInMonth[daysInMonth.length - 1] || 1;
  }, [daysInMonth, selectedDay]);

  // Update selected day if it becomes invalid
  if (validDay !== selectedDay) {
    setSelectedDay(validDay);
  }

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
              Select Date
            </Text>
          </View>

          {/* Date Selection */}
          <View className="flex-row py-4 px-2">
            {/* Month Column */}
            <View className="flex-1 mx-1">
              <Text className="text-text-secondary text-xs text-center mb-2">
                Month
              </Text>
              <ScrollView
                className="max-h-40"
                showsVerticalScrollIndicator={false}
              >
                {availableMonths.map((month, index) => {
                  const actualIndex =
                    selectedYear === minDate.getFullYear()
                      ? index + minDate.getMonth()
                      : index;
                  const isSelected = actualIndex === selectedMonth;
                  return (
                    <TouchableOpacity
                      key={month}
                      onPress={() => handleMonthChange(index)}
                      className={`py-2 px-2 rounded-lg mb-1 ${
                        isSelected ? "bg-primary" : ""
                      }`}
                    >
                      <Text
                        className={`text-center text-sm ${
                          isSelected ? "text-white font-semibold" : "text-text-primary"
                        }`}
                      >
                        {month.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Day Column */}
            <View className="flex-1 mx-1">
              <Text className="text-text-secondary text-xs text-center mb-2">
                Day
              </Text>
              <ScrollView
                className="max-h-40"
                showsVerticalScrollIndicator={false}
              >
                {daysInMonth.map((day) => {
                  const isSelected = day === validDay;
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => setSelectedDay(day)}
                      className={`py-2 px-2 rounded-lg mb-1 ${
                        isSelected ? "bg-primary" : ""
                      }`}
                    >
                      <Text
                        className={`text-center text-sm ${
                          isSelected ? "text-white font-semibold" : "text-text-primary"
                        }`}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Year Column */}
            <View className="flex-1 mx-1">
              <Text className="text-text-secondary text-xs text-center mb-2">
                Year
              </Text>
              <ScrollView
                className="max-h-40"
                showsVerticalScrollIndicator={false}
              >
                {years.map((year) => {
                  const isSelected = year === selectedYear;
                  return (
                    <TouchableOpacity
                      key={year}
                      onPress={() => handleYearChange(year)}
                      className={`py-2 px-2 rounded-lg mb-1 ${
                        isSelected ? "bg-primary" : ""
                      }`}
                    >
                      <Text
                        className={`text-center text-sm ${
                          isSelected ? "text-white font-semibold" : "text-text-primary"
                        }`}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Selected Date Preview */}
          <View className="py-2 px-4 bg-background/50">
            <Text className="text-text-primary text-center">
              {MONTHS[selectedMonth]} {validDay}, {selectedYear}
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
