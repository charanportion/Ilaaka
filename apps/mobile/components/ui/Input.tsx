import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { useTokens } from '@/lib/useTokens';
import { radius, typography } from '@/lib/design-tokens';
import { Text } from '@/components/ui/Text';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, containerStyle, leftIcon, rightIcon, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTokens();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: error ? colors.danger : focused ? colors.focusRing : colors.borderInput,
          paddingHorizontal: 12,
          minHeight: 44,
        }}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          {...rest}
          placeholderTextColor={colors.inkSubtle}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={{
            flex: 1,
            color: colors.ink,
            fontFamily: typography.body.fontFamily,
            fontSize: typography.body.fontSize,
            paddingVertical: 10,
          }}
        />
        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle" style={{ marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
