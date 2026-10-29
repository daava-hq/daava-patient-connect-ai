import React from 'react';
import Logo from '../Logo/Logo';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function AppLogo({ size = 'md' }: AppLogoProps) {
  return <Logo size={size} />;
}
