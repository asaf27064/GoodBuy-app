import { DefaultTheme } from 'react-native-paper'
import { COLORS } from '../styles/colors'

export default {
  ...DefaultTheme,
  roundness: 20,
  //direction: 'rtl', Restore when all text has been converted to hebrew
  colors: {
    ...DefaultTheme.colors,

    primary:   COLORS.goodBuyGreen,
    accent:    COLORS.goodBuyGreen,
    background:'#ffffff',
    surface:   '#ffffff',
    text:      '#000000',

    onPrimary:        '#ffffff',
    onSurface:        '#000000',  
    onSurfaceDisabled:'#888888',
    placeholder:      COLORS.goodBuyGray,
    disabled:         COLORS.goodBuyGrayLight,
    notification:     '#f50057',
    warning:          COLORS.warningYellow
  },

  text: {
    textAlign: "right"
  },

  headlineMedium: {
    fontFamily: 'CustomFont-Bold',
    fontSize: 18,
    fontWeight: 'bold',
  },

  mutedText: {
    fontSize: 14,
    color: COLORS.goodBuyGrayLight
  }
}
