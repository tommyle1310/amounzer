'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { suggestAccounts, type Account } from '@/lib/api-client';

interface AccountSuggestionProps {
  value?: string;
  onSelect: (account: Account) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Debounce delay in milliseconds (default: 300ms per TT99 spec) */
  debounceMs?: number;
  /** Maximum suggestions to show */
  maxSuggestions?: number;
  /** Show account type badge */
  showAccountType?: boolean;
  /** Filter by special reciprocal accounts only (112, 131, 331) */
  specialReciprocalOnly?: boolean;
}

/**
 * Account Suggestion Input with Debounce
 * 
 * Per TT99/2025 requirements, this component provides:
 * - Debounced API calls (300ms default) to reduce server load
 * - Prefix + fuzzy search on account code and name
 * - Support for alphanumeric sub-accounts (e.g., 131-A, 1311)
 * - Visual indication for special reciprocal accounts (112, 131, 331)
 */
export function AccountSuggestion({
  value = '',
  onSelect,
  onInputChange,
  placeholder = 'Nhập mã hoặc tên tài khoản...',
  className,
  inputClassName,
  disabled = false,
  debounceMs = 300,
  maxSuggestions = 10,
  showAccountType = true,
  specialReciprocalOnly = false,
}: AccountSuggestionProps) {
  const [inputValue, setInputValue] = React.useState(value);
  const [suggestions, setSuggestions] = React.useState<Account[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const debouncedSearch = React.useCallback(
    (query: string) => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!query || query.length < 1) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);

      // Set new timer
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await suggestAccounts(query, maxSuggestions);
          
          // Filter for special reciprocal only if requested
          const filtered = specialReciprocalOnly
            ? results.filter((acc) => acc.isSpecialReciprocal)
            : results;

          setSuggestions(filtered);
          setIsOpen(filtered.length > 0);
          setHighlightedIndex(-1);
        } catch (error) {
          console.error('Account suggestion error:', error);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs, maxSuggestions, specialReciprocalOnly],
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onInputChange?.(newValue);
    debouncedSearch(newValue);
  };

  // Handle selection
  const handleSelect = (account: Account) => {
    setInputValue(`${account.code} - ${account.name}`);
    onSelect(account);
    setIsOpen(false);
    setSuggestions([]);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          const selected = suggestions[highlightedIndex];
          if (selected) handleSelect(selected);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-suggestion-item]');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={cn(inputClassName)}
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
        >
          <div className="max-h-60 overflow-auto py-1">
            {suggestions.map((account, index) => (
              <div
                key={account.id}
                data-suggestion-item
                className={cn(
                  'flex cursor-pointer items-center justify-between px-3 py-2 text-sm',
                  'hover:bg-accent hover:text-accent-foreground',
                  index === highlightedIndex && 'bg-accent text-accent-foreground',
                )}
                onClick={() => handleSelect(account)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary">
                    {account.code}
                  </span>
                  <span className="text-muted-foreground">-</span>
                  <span>{account.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {account.isSpecialReciprocal && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Đối ứng
                    </span>
                  )}
                  {showAccountType && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {formatAccountType(account.accountType)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to format account type
function formatAccountType(type: string): string {
  const types: Record<string, string> = {
    ASSET: 'TS',
    LIABILITY: 'NV',
    EQUITY: 'VĐ',
    REVENUE: 'DT',
    EXPENSE: 'CP',
    OFF_BALANCE_SHEET: 'NB',
  };
  return types[type] || type;
}

export default AccountSuggestion;
