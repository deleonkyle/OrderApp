# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

# Order Management App - Performance Optimized

This application has been optimized for performance while maintaining all existing features. The following document outlines the key performance enhancements implemented.

## Performance Optimizations

### 1. Centralized Configuration

All performance-related configurations are centralized in `constants/config.ts`, making it easy to tune performance parameters:

- **Cache Durations**: Configurable TTL for different types of cached data
- **Performance Thresholds**: Monitoring thresholds for database operations, rendering, and network requests
- **UI Configuration**: Settings for animation durations, list rendering, and batch operations
- **Network Settings**: Timeouts, retry policies, and concurrency limits
- **Database Limits**: Query size limits to prevent excessive data loading
- **Feature Flags**: Toggle performance features like offline mode and caching

### 2. State Management

- **Context API**: Implemented a centralized AppContext for global state management
- **Caching**: Intelligent caching of frequently accessed data with configurable TTL
- **Offline Mode**: Support for offline operation with cached data

### 3. Database Operations

- **Query Optimization**: Limited query sizes and implemented pagination
- **Performance Monitoring**: Automatic tracking of database operation times
- **Caching Layer**: In-memory cache for frequently accessed database entities

### 4. UI Performance

- **List Virtualization**: Optimized list rendering with windowing techniques
- **Lazy Loading**: Components for heavy UI elements
- **Debounced Inputs**: Reduced render cycles for input fields
- **Memoization**: Strategic use of useMemo and useCallback

### 5. Monitoring & Debugging

- **Performance Monitoring**: Built-in performance tracking for critical operations
- **Development Tools**: Performance overlay in development mode
- **Warning System**: Automatic warnings when operations exceed thresholds

## Performance Utilities

### Optimized Components

- `OptimizedList`: A performance-optimized list component with windowing
- `LazyLoad`: Component for deferring the rendering of expensive components

### Custom Hooks

- `useRenderPerformance`: Track component render times
- `useDebouncedState`: Prevent excessive re-renders from rapid state changes
- `usePerformanceWarning`: Get warnings about slow-rendering components

## Usage Examples

### Using the OptimizedList Component

```tsx
import { OptimizedList } from '@/lib/optimizations'

function OrdersList({ orders }) {
  return (
    <OptimizedList
      data={orders}
      renderItem={({ item }) => <OrderItem order={item} />}
      keyExtractor={(item) => item.id}
      listName="orders"
      emptyText="No orders found"
    />
  )
}
```

### Performance Monitoring

The app includes a built-in performance monitoring overlay in development mode. To access it:

1. Look for the performance tools in the bottom-right corner of the app
2. Toggle "Show Perf" to view the performance metrics
3. Toggle "Offline Mode" to test offline functionality

## Configuration

Performance parameters can be adjusted in `constants/config.ts`:

```ts
// Example: Adjust cache durations
export const CACHE_DURATION = {
  SHORT: 2 * 60 * 1000, // 2 minutes
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
}

// Example: Adjust performance thresholds
export const PERFORMANCE = {
  DB_OPERATION_THRESHOLD: 500, // ms
  RENDER_THRESHOLD: 300, // ms
}
```

## Best Practices

1. Use the `OptimizedList` component for all lists
2. Implement the `useRenderPerformance` hook in complex components
3. Use `useDebouncedState` for input fields and search functionality
4. Leverage the AppContext for global state instead of prop drilling
5. Monitor the performance overlay during development to identify bottlenecks
