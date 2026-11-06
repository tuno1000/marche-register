import { Navigate, type RouteObject } from 'react-router';
import { CategoriesScreen } from '../features/categories/CategoriesScreen';
import { CheckoutScreen } from '../features/checkout/CheckoutScreen';
import { TenderScreen } from '../features/checkout/TenderScreen';
import { EventEditScreen } from '../features/events/EventEditScreen';
import { EventsScreen } from '../features/events/EventsScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { TransactionDetailScreen } from '../features/history/TransactionDetailScreen';
import { InstallScreen } from '../features/install/InstallScreen';
import { MoreScreen } from '../features/more/MoreScreen';
import { ProductEditScreen } from '../features/products/ProductEditScreen';
import { ProductsScreen } from '../features/products/ProductsScreen';
import { ReceiptScreen } from '../features/receipt/ReceiptScreen';
import { DiscountPresetsScreen } from '../features/settings/DiscountPresetsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { SummaryScreen } from '../features/summary/SummaryScreen';
import { ErrorScreen } from './ErrorScreen';
import { FullScreenLayout, TabLayout } from './Layouts';
import { RootLayout } from './RootLayout';

/** 画面と URL の対応（04-技術設計 3 章） */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <ErrorScreen />,
    children: [
      {
        // 下のタブを表示する画面
        element: <TabLayout />,
        children: [
          { path: '/', element: <CheckoutScreen /> },
          { path: '/history', element: <HistoryScreen /> },
          { path: '/summary', element: <SummaryScreen /> },
          { path: '/more', element: <MoreScreen /> },
        ],
      },
      {
        // 全画面で開く画面（タブを隠して「戻る」で戻る）
        element: <FullScreenLayout />,
        children: [
          { path: '/tender', element: <TenderScreen /> },
          { path: '/receipt/:txId', element: <ReceiptScreen /> },
          { path: '/history/:txId', element: <TransactionDetailScreen /> },
          { path: '/products', element: <ProductsScreen /> },
          { path: '/products/new', element: <ProductEditScreen /> },
          { path: '/products/:id', element: <ProductEditScreen /> },
          { path: '/categories', element: <CategoriesScreen /> },
          { path: '/events', element: <EventsScreen /> },
          { path: '/events/new', element: <EventEditScreen /> },
          { path: '/events/:id', element: <EventEditScreen /> },
          { path: '/settings', element: <SettingsScreen /> },
          { path: '/settings/discounts', element: <DiscountPresetsScreen /> },
          { path: '/install', element: <InstallScreen /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
