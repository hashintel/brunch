'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { ChevronDownIcon, WrenchIcon } from 'lucide-react';
import {
  createContext,
  type ComponentProps,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';

interface TaskContextValue {
  isOpen: boolean;
  isRunning: boolean;
}

const TaskContext = createContext<TaskContextValue | null>(null);

function useTask() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('Task components must be used within Task');
  }
  return context;
}

const AUTO_CLOSE_DELAY = 1000;

export type TaskItemFileProps = ComponentProps<'div'>;

export const TaskItemFile = ({ children, className, ...props }: TaskItemFileProps) => (
  <div
    className={cn(
      'inline-flex items-center gap-1 rounded-md border border-rule bg-white px-1.5 py-0.5 text-xs text-hint',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type TaskItemProps = ComponentProps<'div'>;

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
  <div className={cn('text-xs leading-relaxed text-hint', className)} {...props}>
    {children}
  </div>
);

export type TaskProps = ComponentProps<typeof Collapsible> & {
  isRunning?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const Task = ({
  className,
  isRunning = false,
  open,
  defaultOpen,
  // oxlint-disable-next-line typescript-eslint/unbound-method -- callback prop, not a bound method
  onOpenChange: onOpenChangeProp,
  children,
  ...props
}: TaskProps) => {
  const resolvedDefaultOpen = defaultOpen ?? isRunning;
  const isExplicitlyClosed = defaultOpen === false;
  const notifyOpenChange = useCallback((value: boolean) => onOpenChangeProp?.(value), [onOpenChangeProp]);
  const [isOpen, setIsOpen] = useControllableState<boolean>({
    defaultProp: resolvedDefaultOpen,
    onChange: notifyOpenChange,
    prop: open,
  });
  const hasEverRunRef = useRef(isRunning);
  const [hasAutoClosed, setHasAutoClosed] = useState(false);

  useEffect(() => {
    if (isRunning) {
      hasEverRunRef.current = true;

      if (!isOpen && !isExplicitlyClosed && !hasAutoClosed) {
        setIsOpen(true);
      }
    }
  }, [isExplicitlyClosed, isOpen, isRunning, setIsOpen, hasAutoClosed]);

  useEffect(() => {
    if (hasEverRunRef.current && !isRunning && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, AUTO_CLOSE_DELAY);

      return () => clearTimeout(timer);
    }
  }, [hasAutoClosed, isOpen, isRunning, setIsOpen]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsOpen(nextOpen);
    },
    [setIsOpen],
  );

  const contextValue = useMemo(() => ({ isOpen, isRunning }), [isOpen, isRunning]);

  return (
    <TaskContext.Provider value={contextValue}>
      <Collapsible className={cn(className)} onOpenChange={handleOpenChange} open={isOpen} {...props}>
        {children}
      </Collapsible>
    </TaskContext.Provider>
  );
};

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  collapsible?: boolean;
  showIcon?: boolean;
  title: string;
};

export const TaskTrigger = ({
  children,
  className,
  collapsible,
  showIcon = true,
  title,
  ...props
}: TaskTriggerProps) => {
  const { isOpen, isRunning } = useTask();
  const isCollapsible = collapsible ?? isRunning;

  return (
    <CollapsibleTrigger
      className={cn(
        'flex w-full items-center gap-1 text-left text-xs text-hint transition-colors',
        isCollapsible ? 'hover:text-hint' : 'cursor-default',
        className,
      )}
      disabled={!isCollapsible}
      {...props}
    >
      {children ?? (
        <>
          {showIcon ? <WrenchIcon className="size-3.5" /> : null}
          <span>{title}</span>
          {isCollapsible ? (
            <ChevronDownIcon
              className={cn('size-3.5 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
            />
          ) : null}
        </>
      )}
    </CollapsibleTrigger>
  );
};

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({ children, className, ...props }: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      'text-hint outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2',
      className,
    )}
    {...props}
  >
    <div className="mt-2 space-y-1.5 border-l border-rule pl-3">{children}</div>
  </CollapsibleContent>
);
