import { AppRegistry } from 'react-native';
import App from './App';
import appConfig from './app.json';

const appName = appConfig?.name || appConfig?.expo?.name || 'SaraAI';

AppRegistry.registerComponent(appName, () => App);


