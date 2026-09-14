import { createElement as h } from 'react'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { cn } from 'cn'

export function AlertDialog(properties) {
  return h(AlertDialogPrimitive.Root, { 'data-slot': 'alert-dialog', ...properties })
}

export function AlertDialogTrigger(properties) {
  return h(AlertDialogPrimitive.Trigger, { 'data-slot': 'alert-dialog-trigger', ...properties })
}

export function AlertDialogPortal(properties) {
  return h(AlertDialogPrimitive.Portal, { 'data-slot': 'alert-dialog-portal', ...properties })
}

export function AlertDialogCancel(properties) {
  return h(AlertDialogPrimitive.Cancel, { 'data-slot': 'alert-dialog-cancel', ...properties })
}

export function AlertDialogAction(properties) {
  return h(AlertDialogPrimitive.Action, { 'data-slot': 'alert-dialog-action', ...properties })
}

export function AlertDialogOverlay({ className, ...properties }) {
  return h(AlertDialogPrimitive.Overlay, {
    'data-slot': 'alert-dialog-overlay',
    className: cn(
      'fixed inset-0 z-50 bg-govuk-text/50 data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
      className
    ),
    ...properties
  })
}

export function AlertDialogContent({ className, children, ...properties }) {
  return h(
    AlertDialogPortal,
    null,
    h(AlertDialogOverlay),
    h(
      AlertDialogPrimitive.Content,
      {
        'data-slot': 'alert-dialog-content',
        className: cn(
          'fixed left-1/2 top-1/2 z-50 box-border grid w-[calc(100%-2rem)] max-w-[35rem] -translate-x-1/2 -translate-y-1/2 gap-govuk-4 border-2 border-govuk-text bg-govuk-surface p-govuk-responsive-6 shadow-[0_5px_15px_rgba(0,0,0,0.35)] outline-none focus-visible:outline-4 focus-visible:outline-offset-0 focus-visible:outline-govuk-focus',
          className
        ),
        ...properties
      },
      children
    )
  )
}

export function AlertDialogHeader({ className, ...properties }) {
  return h('div', {
    'data-slot': 'alert-dialog-header',
    className: cn('grid gap-govuk-2', className),
    ...properties
  })
}

export function AlertDialogFooter({ className, ...properties }) {
  return h('div', {
    'data-slot': 'alert-dialog-footer',
    className: cn('flex flex-col gap-govuk-2 govuk-tablet:flex-row govuk-tablet:items-start', className),
    ...properties
  })
}

export function AlertDialogTitle(properties) {
  return h(AlertDialogPrimitive.Title, { 'data-slot': 'alert-dialog-title', ...properties })
}

export function AlertDialogDescription(properties) {
  return h(AlertDialogPrimitive.Description, { 'data-slot': 'alert-dialog-description', ...properties })
}
