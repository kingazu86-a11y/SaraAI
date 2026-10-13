import React from 'react';
import { requireNativeComponent, ViewProps } from 'react-native';

interface NativeCameraPreviewProps extends ViewProps {
  facing?: 'back' | 'front';
  flash?: 'off' | 'on' | 'auto';
}

const NativeCameraPreview = requireNativeComponent<NativeCameraPreviewProps>('CameraPreviewView');

export interface CameraPreviewComponentProps extends ViewProps {
  facing?: 'back' | 'front';
  flash?: 'off' | 'on' | 'auto';
}

export const CameraPreviewComponent: React.FC<CameraPreviewComponentProps> = ({
  facing = 'back',
  flash = 'auto',
  style,
  ...props
}) => {
  return (
    <NativeCameraPreview
      style={style}
      facing={facing}
      flash={flash}
      {...props}
    />
  );
};
