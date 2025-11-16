// components/AppHeader.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { ScaledSheet, ms, mvs, s } from 'react-native-size-matters';
import Svg, { Path } from 'react-native-svg';

interface AppHeaderProps {
  title: string;
  rightElement?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  rightElement,
}) => {
  return (
    <View style={styles.headerBox}>
      {/* Exact same wave as NotificationsScreen */}
      <Svg 
        width="100%" 
        height={mvs(260)} 
        viewBox="0 0 1440 320" 
        style={styles.waveTop}
        preserveAspectRatio="none"
      >
        <Path fill="#3864C3" d="M0,64 C720,-32 720,160 1440,64 L1440,0 L0,0 Z" />
      </Svg>

      <View style={styles.headerContent}>
        {/* Left placeholder for balance */}
        <View style={styles.placeholder} />
        
        {/* Centered title */}
        <Text style={styles.headerTitle}>
          {title}
        </Text>
        
        {/* Right element or placeholder */}
        <View style={styles.rightElementContainer}>
          {rightElement || <View style={styles.placeholder} />}
        </View>
      </View>
    </View>
  );
};

const styles = ScaledSheet.create({
  headerBox: {
    width: '100%',
    height: mvs(90),
    backgroundColor: '#0AADFF',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  waveTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    zIndex: 2,
    width: '100%',
    marginTop: mvs(30),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
  },
  placeholder: {
    width: s(24),
  },
  rightElementContainer: {
    marginLeft: 'auto',
    zIndex: 2,
  },
});