import AsyncStorage from '@react-native-async-storage/async-storage';

import { createOfflineQuickExpenseStore } from './offline-quick-expense-store';

export const offlineQuickExpenseStore = createOfflineQuickExpenseStore(AsyncStorage);
