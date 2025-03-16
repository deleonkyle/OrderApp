import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, FlatList, ListRenderItem, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { UI, PERFORMANCE } from '@/constants/config'
import { perfMonitor } from './utils'

/**
 * Optimized list component with windowing and performance monitoring
 */
interface OptimizedListProps<T> {
  data: T[]
  renderItem: ListRenderItem<T>
  keyExtractor: (item: T, index: number) => string
  emptyText?: string
  loadingText?: string
  isLoading?: boolean
  onEndReached?: () => void
  onEndReachedThreshold?: number
  initialNumToRender?: number
  windowSize?: number
  maxToRenderPerBatch?: number
  updateCellsBatchingPeriod?: number
  listName?: string
}

export function OptimizedList<T>({
  data,
  renderItem,
  keyExtractor,
  emptyText = 'No items found',
  loadingText = 'Loading...',
  isLoading = false,
  onEndReached,
  onEndReachedThreshold = 0.5,
  initialNumToRender = UI.LIST_INITIAL_ITEMS,
  windowSize = UI.LIST_WINDOW_SIZE,
  maxToRenderPerBatch = UI.BATCH_SIZE,
  updateCellsBatchingPeriod = 50,
  listName = 'list'
}: OptimizedListProps<T>) {
  // Track render performance
  const renderStartTimeRef = useRef(0)
  
  // Start timing when component mounts or data changes
  useEffect(() => {
    renderStartTimeRef.current = performance.now()
    perfMonitor.startTimer(`render_${listName}`)
    
    return () => {
      const renderTime = performance.now() - renderStartTimeRef.current
      perfMonitor.endTimer(`render_${listName}`)
      
      if (renderTime > PERFORMANCE.RENDER_THRESHOLD) {
        console.warn(`${listName} rendering took ${renderTime.toFixed(2)}ms, which exceeds the threshold of ${PERFORMANCE.RENDER_THRESHOLD}ms`)
      }
    }
  }, [data, listName])
  
  // Memoize the empty component to prevent unnecessary re-renders
  const ListEmptyComponent = useMemo(() => {
    return () => (
      <View style={styles.emptyContainer}>
        {isLoading ? (
          <>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.emptyText}>{loadingText}</Text>
          </>
        ) : (
          <Text style={styles.emptyText}>{emptyText}</Text>
        )}
      </View>
    )
  }, [isLoading, emptyText, loadingText])
  
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={ListEmptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      initialNumToRender={initialNumToRender}
      windowSize={windowSize}
      maxToRenderPerBatch={maxToRenderPerBatch}
      updateCellsBatchingPeriod={updateCellsBatchingPeriod}
      removeClippedSubviews={true}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  )
}

/**
 * Hook to track component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(0)
  
  useEffect(() => {
    renderCount.current += 1
    const startTime = performance.now()
    perfMonitor.startTimer(`render_${componentName}`)
    
    return () => {
      const renderTime = perfMonitor.endTimer(`render_${componentName}`)
      lastRenderTime.current = renderTime
      
      if (renderTime > PERFORMANCE.RENDER_THRESHOLD) {
        console.warn(`${componentName} rendering took ${renderTime.toFixed(2)}ms, which exceeds the threshold of ${PERFORMANCE.RENDER_THRESHOLD}ms`)
      }
    }
  })
  
  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current
  }
}

/**
 * Hook for debounced state updates to prevent excessive re-renders
 */
export function useDebouncedState<T>(initialValue: T, delay: number = 300): [T, (value: T) => void, T] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue)
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(immediateValue)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [immediateValue, delay])
  
  return [debouncedValue, setImmediateValue, immediateValue]
}

/**
 * Hook to detect slow renders and provide optimization suggestions
 */
export function usePerformanceWarning(componentName: string, dependencies: any[] = []) {
  useEffect(() => {
    perfMonitor.startTimer(`${componentName}_effect`)
    
    return () => {
      const time = perfMonitor.endTimer(`${componentName}_effect`)
      if (time > PERFORMANCE.RENDER_THRESHOLD) {
        console.warn(
          `Performance warning: ${componentName} effect took ${time.toFixed(2)}ms.\n` +
          `Consider optimizing this component with useMemo or useCallback.`
        )
      }
    }
  }, dependencies)
}

/**
 * Lazy loading component for heavy components
 */
export function LazyLoad({ 
  children, 
  placeholder = <ActivityIndicator size="large" />,
  delay = 100
}: { 
  children: React.ReactNode, 
  placeholder?: React.ReactNode,
  delay?: number
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, delay)
    
    return () => clearTimeout(timer)
  }, [delay])
  
  return isLoaded ? <>{children}</> : <View style={styles.lazyContainer}>{placeholder}</View>
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  lazyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
}) 