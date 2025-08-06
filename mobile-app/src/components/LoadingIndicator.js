import React from 'react';
import { View, StyleSheet } from 'react-native';

import {
  useTheme,
  Text,
  ActivityIndicator,
  IconButton,
  Chip,
  Badge,
} from 'react-native-paper';


export const LoadingIndicator = ({loadingMessage, indicatorSize='large'}) => {

    const theme = useTheme();
    
    return (
        <View style={styles.loader}>
          <ActivityIndicator size={indicatorSize} color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            {loadingMessage}
          </Text>
        </View>
      );

};

const styles = StyleSheet.create({
    loader: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        gap: 16
      },
      loadingText: {
        marginTop: 8,
      },
});