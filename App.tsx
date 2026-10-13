import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AssistantProvider } from './src/store/AssistantStore';
import { AppShell } from './src/components/layout/AppShell';

const App = (): React.JSX.Element => {
  return (
    <SafeAreaProvider>
      <AssistantProvider>
        <AppShell />
      </AssistantProvider>
    </SafeAreaProvider>
  );
};

export default App;
