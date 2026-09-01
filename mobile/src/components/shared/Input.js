// components/shared/Input.js
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  type = 'text',      // text | password | email | phone | number | multiline
  required = false,
  error,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  inputStyle,
  maxLength,
  onBlur,
  onFocus,
  autoFocus = false,
  autoCapitalize,
  autoCorrect = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const isPassword = type === 'password';
  const isMultiline = type === 'multiline';

  const keyboardType =
    type === 'email' ? 'email-address' :
    type === 'phone' ? 'phone-pad' :
    type === 'number' ? 'decimal-pad' : 'default';

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}> *</Text>}
        </View>
      )}
      <View style={[
        styles.inputWrapper,
        focused && styles.inputFocused,
        error && styles.inputError,
        disabled && styles.inputDisabled,
        isMultiline && styles.inputMultiline,
      ]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithLeft, isMultiline && styles.multilineText, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray400}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          editable={!disabled}
          multiline={isMultiline}
          numberOfLines={isMultiline ? 4 : 1}
          maxLength={maxLength}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize !== undefined ? autoCapitalize : 'none'}
          autoCorrect={autoCorrect}
          onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }}
          onBlur={() => { setFocused(false); onBlur && onBlur(); }}
        />
        {isPassword && (
          <TouchableOpacity style={styles.rightIcon} onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.gray400} />
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.gray700 },
  required: { fontSize: 14, color: Colors.error },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    borderRadius: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputError: { borderColor: Colors.error },
  inputDisabled: { backgroundColor: Colors.gray50, opacity: 0.7 },
  inputMultiline: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 100 },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 2 },
  inputWithLeft: { marginLeft: 8 },
  multilineText: { textAlignVertical: 'top' },
  leftIcon: { marginRight: 6 },
  rightIcon: { marginLeft: 6 },
  error: { fontSize: 12, color: Colors.error, marginTop: 4, marginLeft: 2 },
});

export default Input;
