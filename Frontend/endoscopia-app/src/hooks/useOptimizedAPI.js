import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

/**
 * Hook optimizado para llamadas API con:
 * - Cache automático
 * - Debounce
 * - Retry automático
 * - Loading states
 */
export function useOptimizedAPI(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const {
    enabled = true,
    debounceMs = 300,
    retryAttempts = 3,
    cacheKey = null,
    dependencies = []
  } = options;

  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Función para limpiar cache
  const clearCache = useCallback(() => {
    if (cacheKey) {
      sessionStorage.removeItem(`cache_${cacheKey}`);
    }
  }, [cacheKey]);

  // Función para obtener datos del cache
  const getCachedData = useCallback(() => {
    if (!cacheKey) return null;
    
    try {
      const cached = sessionStorage.getItem(`cache_${cacheKey}`);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > 5 * 60 * 1000; // 5 minutos
        if (!isExpired) {
          return cachedData;
        }
      }
    } catch (error) {
      console.warn('Error reading cache:', error);
    }
    return null;
  }, [cacheKey]);

  // Función para guardar datos en cache
  const setCachedData = useCallback((data) => {
    if (!cacheKey) return;
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      sessionStorage.setItem(`cache_${cacheKey}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error saving cache:', error);
    }
  }, [cacheKey]);

  // Función principal para hacer la llamada API
  const fetchData = useCallback(async (isRetry = false) => {
    if (!enabled || !url) return;

    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crear nuevo AbortController
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // Intentar obtener datos del cache primero
      if (!isRetry && cacheKey) {
        const cachedData = getCachedData();
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      // Hacer la llamada API
      const response = await api.get(url, {
        signal: abortControllerRef.current.signal,
        timeout: 10000
      });

      const responseData = response.data;
      
      // Guardar en cache si está habilitado
      if (cacheKey) {
        setCachedData(responseData);
      }

      setData(responseData);
      setRetryCount(0);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return; // Request fue cancelado
      }

      console.error(`[useOptimizedAPI] Error en ${url}:`, error);
      
      // Retry automático
      if (retryCount < retryAttempts) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchData(true);
        }, 1000 * Math.pow(2, retryCount)); // Exponential backoff
      } else {
        setError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [url, enabled, cacheKey, retryCount, retryAttempts, getCachedData, setCachedData]);

  // Debounced fetch
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchData();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchData, debounceMs, ...dependencies]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    retryCount,
    refetch: () => fetchData(),
    clearCache
  };
}

/**
 * Hook para múltiples llamadas API en paralelo
 */
export function useOptimizedAPIBatch(requests, options = {}) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBatch = useCallback(async () => {
    if (!requests || requests.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const promises = requests.map(async (request) => {
        const { key, url, ...requestOptions } = request;
        const response = await api.get(url, requestOptions);
        return { key, data: response.data };
      });

      const responses = await Promise.all(promises);
      const resultsMap = {};
      
      responses.forEach(({ key, data }) => {
        resultsMap[key] = data;
      });

      setResults(resultsMap);
    } catch (error) {
      console.error('[useOptimizedAPIBatch] Error:', error);
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [requests]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  return {
    results,
    loading,
    error,
    refetch: fetchBatch
  };
}
