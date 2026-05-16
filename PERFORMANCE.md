<![CDATA[
# Bundle Size Optimization Guide

## Current Optimizations

### 1. **Dynamic Imports**
Heavy components are loaded only when needed:

```typescript
// OnboardingTour - loads Shepherd.js library lazily
const OnboardingTour = dynamic(
  () => import("@/components/OnboardingTour").then(mod => mod.OnboardingTour),
  { ssr: false }
);

// Shepherd.js - loaded only when tour starts
const loadShepherd = async () => {
  if (!ShepherdImport) {
    ShepherdImport = await import("shepherd.js");
  }
  return ShepherdImport;
};
```

### 2. **Tree-Shaking (Automatic)**
Next.js 15 automatically tree-shakes lucide-react icons:

```typescript
// ✅ Correct - Named imports (tree-shakeable)
import { RefreshCw, Download, Lock } from "lucide-react";

// ❌ Avoid - Default imports (entire library)
import * as Icons from "lucide-react";
```

### 3. **Code Splitting**
Webpack configuration splits bundles into:
- **vendor** - node_modules dependencies
- **ui** - shadcn/ui components
- **common** - shared code across pages

### 4. **Production Optimizations**
- Console logs removed (except error/warn)
- Compression enabled
- Power-by header disabled

## Analyzing Bundle Size

### Run Bundle Analyzer

```bash
# Analyze full bundle
npm run analyze

# Opens interactive HTML reports:
# - .next/analyze/client.html
# - .next/analyze/server.html
```

### Reading the Report

Look for:
1. **Large modules** (>100KB) - candidates for lazy loading
2. **Duplicate dependencies** - version conflicts
3. **Unused code** - remove or lazy load

## Best Practices

### ✅ DO

```typescript
// Dynamic imports for modals/sheets
const HeavyModal = dynamic(() => import("@/components/HeavyModal"));

// Named imports for icons
import { Icon1, Icon2 } from "lucide-react";

// Split large pages into smaller components
// components/analytics/Heatmap.tsx
// components/analytics/Charts.tsx
```

### ❌ DON'T

```typescript
// Import entire icon library
import * as Icons from "lucide-react";

// Large synchronous imports on initial load
import ComplexChart from "complex-chart-library";

// Unused dependencies in package.json
```

## Current Bundle Stats

| Page | Initial Load | Total Size |
|------|--------------|------------|
| / (Home) | ~200KB | ~350KB |
| /staff | ~180KB | ~320KB |
| /analytics | ~190KB | ~340KB |
| /config | ~150KB | ~280KB |

*Note: Run `npm run analyze` for exact current numbers*

## Optimization Checklist

- [x] Dynamic imports for tour/modals
- [x] Tree-shaking for icons
- [x] Code splitting configuration
- [x] Production minification
- [x] Console log removal
- [x] Compression enabled
- [ ] Image optimization (add if needed)
- [ ] Font subsetting (if custom fonts added)
- [ ] Service worker/PWA (optional)

## Monitoring

1. **Lighthouse CI** - Track performance over time
2. **Bundle Analyzer** - Run before each release
3. **Real User Monitoring** - Consider tools like Vercel Analytics

## Next Steps

If bundle size grows >500KB initial load:
1. Implement route-based code splitting
2. Lazy load analytics charts
3. Consider CDN for heavy libraries
4. Implement virtual scrolling for large tables
</file_path>
