# Settings Management System Documentation

## Overview

The settings management system provides a robust, type-safe, and extensible way to manage application preferences. It includes features like automatic validation, migrations, backup/restore, and real-time change notifications.

## Architecture

The settings system follows a layered architecture:

```
┌─────────────────┐
│   UI/Renderer   │
└────────┬────────┘
         │ IPC
┌────────▼────────┐
│  IPC Handlers   │
└────────┬────────┘
         │
┌────────▼────────┐
│Settings Service │
└────────┬────────┘
         │
┌────────▼────────┐
│  Repository     │
└────────┬────────┘
         │
┌────────▼────────┐
│ electron-store  │
└─────────────────┘
```

## Components

### 1. Settings Schema (`src/shared/types/settings.ts`)

Defines the complete settings structure using Zod for runtime validation:

- **General Settings**: Download directory, concurrent downloads, auto-start, notifications
- **Quality Settings**: Preferred quality, fallback options, custom rules
- **Network Settings**: Timeout, retries, proxy configuration, headers
- **UI Settings**: Theme, language, window bounds, tray options
- **Advanced Settings**: FFmpeg path, debug mode, telemetry, log level

### 2. Settings Repository (`src/main/services/settings-store.repository.ts`)

Low-level data access layer that:
- Manages persistence using electron-store
- Provides caching for performance
- Handles validation and schema enforcement
- Supports backup/restore operations
- Manages import/export functionality

### 3. Settings Service (`src/main/services/settings.service.ts`)

Business logic layer that:
- Coordinates between repository and migration service
- Emits events for settings changes
- Applies settings side effects (theme changes, proxy configuration)
- Manages automatic backups
- Handles validation with custom business rules

### 4. Migration Service (`src/main/services/settings-migration.service.ts`)

Handles version migrations:
- Automatic migration detection
- Versioned migration definitions
- Rollback support
- Migration history tracking
- Automatic backup before migrations

### 5. IPC Handlers (`src/main/ipc/handlers/settings-store.handler.ts`)

Provides cross-process communication:
- 25+ IPC endpoints for settings operations
- Type-safe communication using shared types
- Error handling and validation

## Usage Examples

### Reading Settings

```typescript
// In main process
const settings = await settingsService.getAll();
const generalSettings = await settingsService.get('general');

// From renderer process
const settings = await window.electron.settings.getAll();
const theme = await window.electron.settings.get('ui').theme;
```

### Updating Settings

```typescript
// Update entire section
await settingsService.set('general', {
  downloadDirectory: '/new/path',
  maxConcurrentDownloads: 5,
  // ... other general settings
});

// Update single setting
await settingsService.updateSetting('ui', 'theme', 'dark');
```

### Watching for Changes

```typescript
// In main process
settingsService.on('settings:changed', ({ section, key, value }) => {
  console.log(`Setting ${section}.${key} changed to ${value}`);
});

// Theme changes
settingsService.on('theme:change', (theme) => {
  applyTheme(theme);
});

// In renderer process
window.electron.settings.onChange((changes) => {
  console.log('Settings changed:', changes);
});
```

### Backup and Restore

```typescript
// Create backup
const backupPath = await settingsService.backup();

// Restore from backup
await settingsService.restore(backupPath);

// List available backups
const backups = await settingsService.listBackups();

// Auto-backup (keeps last 10)
await settingsService.autoBackup();
```

### Import/Export

```typescript
// Export settings
const exportData = await settingsService.export();
fs.writeFileSync('settings.json', exportData);

// Import settings
const importData = fs.readFileSync('settings.json', 'utf8');
await settingsService.import(importData);
```

## Migration System

### Creating a New Migration

Add a new migration to `SettingsMigrationService`:

```typescript
this.migrations.set('1.3.0', {
  version: '1.3.0',
  description: 'Add new feature settings',
  up: (settings: any) => {
    // Transform settings to new format
    return {
      ...settings,
      newFeature: {
        enabled: true,
        config: 'default'
      }
    };
  },
  down: (settings: any) => {
    // Rollback transformation
    const { newFeature, ...rest } = settings;
    return rest;
  }
});
```

### Migration Process

1. On startup, the system checks if migrations are needed
2. Creates a backup before applying migrations
3. Applies migrations sequentially
4. Records migration history
5. Emits migration events

### Rollback

```typescript
// Rollback to specific version
const result = await settingsService.rollbackSettings('1.1.0');
if (!result.success) {
  console.error('Rollback failed:', result.errors);
}
```

## Validation

### Schema Validation

Automatic validation using Zod schemas:

```typescript
const result = await settingsService.validateSettings(settings);
if (!result.isValid) {
  console.error('Validation errors:', result.errors);
  console.warn('Validation warnings:', result.warnings);
}
```

### Custom Validation Rules

The service layer adds business logic validation:

- Download directory existence check
- Proxy configuration validation
- FFmpeg path validation
- Concurrent download limits

## Events

The settings system emits various events:

| Event | Description | Payload |
|-------|-------------|---------|
| `settings:changed` | Any setting changed | `{ section, key, value, oldValue }` |
| `settings:reset` | Settings reset | `{ section? }` |
| `settings:imported` | Settings imported | `{ timestamp }` |
| `settings:backup` | Backup created | `{ path, timestamp }` |
| `settings:restored` | Settings restored | `{ path, timestamp }` |
| `settings:migrated` | Migration completed | `{ fromVersion, toVersion }` |
| `settings:cleared` | All settings cleared | `{ timestamp }` |
| `theme:change` | Theme changed | `theme: string` |
| `language:change` | Language changed | `language: string` |
| `proxy:configure` | Proxy settings changed | `ProxySettings` |

## File Locations

Settings are stored in platform-specific locations:

- **Windows**: `%APPDATA%/video-downloader-app/`
- **macOS**: `~/Library/Application Support/video-downloader-app/`
- **Linux**: `~/.config/video-downloader-app/`

Files:
- `app-settings.json` - Main settings file
- `backups/` - Backup directory
- `migration-backups/` - Migration backup directory
- `migration-history.json` - Migration history

## Security Considerations

1. **Encryption**: Sensitive settings can be encrypted using `SETTINGS_ENCRYPTION_KEY` environment variable
2. **Validation**: All input is validated against schemas
3. **Sanitization**: File paths and URLs are sanitized
4. **Permissions**: Settings files use appropriate OS permissions

## Testing

The settings system includes comprehensive tests:

```bash
# Run all settings tests
bun run test:vitest src/main/services/__tests__/*.vitest.test.ts

# Run specific test suite
bun run test:vitest src/main/services/__tests__/settings.service.vitest.test.ts
```

Test coverage includes:
- Schema validation
- CRUD operations
- Migration scenarios
- Backup/restore
- Import/export
- Event emissions
- Error handling

## Troubleshooting

### Common Issues

1. **Settings not persisting**: Check file permissions in the app data directory
2. **Migration failures**: Check migration history and logs
3. **Validation errors**: Review the schema requirements
4. **Import failures**: Ensure the import data matches the current schema version

### Debug Mode

Enable debug logging:

```typescript
await settingsService.updateSetting('advanced', 'enableDebugMode', true);
await settingsService.updateSetting('advanced', 'logLevel', 'debug');
```

### Reset Settings

```typescript
// Reset all settings
await settingsService.reset();

// Reset specific section
await settingsService.reset('general');

// Clear all settings and data
await settingsService.clearAll();
```

## Best Practices

1. **Always validate** user input before saving
2. **Use type-safe methods** from the shared types
3. **Handle errors gracefully** with user-friendly messages
4. **Create backups** before major changes
5. **Test migrations** thoroughly before deployment
6. **Monitor events** for reactive UI updates
7. **Document new settings** in the schema
8. **Version migrations** properly for rollback support

## API Reference

### SettingsService Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `getAll()` | Get all settings | - | `Promise<AppSettings>` |
| `get(section)` | Get section settings | `section: SettingSectionKey` | `Promise<SectionSettings>` |
| `setAll(settings)` | Set all settings | `settings: AppSettings` | `Promise<void>` |
| `set(section, value)` | Set section settings | `section: SettingSectionKey, value: SectionSettings` | `Promise<void>` |
| `updateSetting(section, key, value)` | Update single setting | `section: SettingSectionKey, key: string, value: any` | `Promise<void>` |
| `reset(section?)` | Reset settings | `section?: SettingSectionKey` | `Promise<void>` |
| `validateSettings(settings)` | Validate settings | `settings: Partial<AppSettings>` | `Promise<ValidationResult>` |
| `export()` | Export settings | - | `Promise<string>` |
| `import(data)` | Import settings | `data: string` | `Promise<void>` |
| `backup()` | Create backup | - | `Promise<string>` |
| `restore(path)` | Restore backup | `path: string` | `Promise<void>` |
| `listBackups()` | List backups | - | `Promise<string[]>` |
| `needsMigration()` | Check migration need | - | `Promise<boolean>` |
| `runMigration()` | Run migrations | - | `Promise<MigrationResult>` |
| `rollbackSettings(version)` | Rollback to version | `version: string` | `Promise<MigrationResult>` |

## Future Enhancements

Planned improvements:

1. **Cloud Sync**: Sync settings across devices
2. **Profiles**: Multiple setting profiles
3. **Conditional Settings**: Settings that depend on other settings
4. **Setting Groups**: Logical grouping for complex configurations
5. **Setting Templates**: Pre-configured setting combinations
6. **Setting History**: Complete change history with undo/redo
7. **Setting Search**: Search through settings
8. **Setting Recommendations**: AI-powered setting suggestions