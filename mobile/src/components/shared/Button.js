// components/shared/Button.js
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/Colors';

const Button = ({
  title,
  onPress,
  variant = 'primary', // primary | secondary | outline | danger | ghost
  size = 'md',         // sm | md | lg
  loading = false,
  disabled = false,
  icon = null,
  fullWidth = true,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${size}`],
    styles[`textVariant_${variant}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.primary} size="small" />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={textStyles}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { marginRight: 4 },

  // Sizes
  size_sm: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  size_md: { paddingVertical: 14, paddingHorizontal: 20 },
  size_lg: { paddingVertical: 18, paddingHorizontal: 24 },

  // Variants
  variant_primary: { backgroundColor: Colors.primary },
  variant_secondary: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  variant_outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  variant_danger: { backgroundColor: Colors.danger },
  variant_ghost: { backgroundColor: 'transparent' },
  variant_warning: { backgroundColor: Colors.warning },
  variant_success: { backgroundColor: Colors.success },

  // Text
  text: { fontWeight: '600', letterSpacing: 0.3 },
  text_sm: { fontSize: 13 },
  text_md: { fontSize: 15 },
  text_lg: { fontSize: 17 },

  textVariant_primary: { color: Colors.white },
  textVariant_secondary: { color: Colors.primary },
  textVariant_outline: { color: Colors.primary },
  textVariant_danger: { color: Colors.white },
  textVariant_ghost: { color: Colors.primary },
  textVariant_warning: { color: Colors.white },
  textVariant_success: { color: Colors.white },

  disabled: { opacity: 0.5 },
  textDisabled: {},
});

export default Button;
