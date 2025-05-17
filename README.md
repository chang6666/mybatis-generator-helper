# MyBatis Generator Extension

A Visual Studio Code extension that generates MyBatis entities, mappers, and XML files from your database schema.

## Features

- Generate Java entity classes from database tables with table/column comments
- Generate MyBatis mapper interfaces
- Generate MyBatis XML mapping files
- Support for MySQL databases
- Interactive table selection
- Customizable package names and output directories
- Jump between Mapper interfaces and XML files
- CodeLens support for method navigation
- File decorations for Mapper files

## Requirements

- Java Development Kit (JDK) installed
- MySQL database
- Visual Studio Code 1.99.0 or higher

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
2. Type "MyBatis: Generate" and select the command
3. Enter your database connection details
4. Choose generation mode (all tables or select specific tables)
5. Enter the package name for generated files
6. Select the output directory
7. The extension will generate:
   - Entity classes in `src/main/java/<package>/entity/`
   - Mapper interfaces in `src/main/java/<package>/mapper/`
   - XML files in `src/main/resources/mapper/`

### Navigation Features

- Use `Alt+B` (Windows) or `Cmd+B` (macOS) to jump between Mapper interface and XML implementation
- Click on the CodeLens hints above mapper methods to navigate to their XML implementations
- Use the "MyBatis: Create XML Implementation" command to generate XML snippets for new mapper methods

## Extension Settings

This extension contributes the following settings:

* `mybatisGeneratorHelper.defaultPackageName`: Default package name for generated files
* `mybatisGeneratorHelper.templatePath`: Custom template path for code generation
* `mybatisGeneratorHelper.indentSize`: Indentation size for generated files
* `mybatisGeneratorHelper.namingStrategy`: Naming strategy for generated files (camelCase or snake_case)
* `mybatisGeneratorHelper.tablePrefixHandling`: How to handle table prefixes: keep them, remove them, or ask each time
* `mybatisGeneratorHelper.tablePrefix`: List of table prefixes to recognize (e.g. ['biz_', 'sys_'])

## Release Notes

### 0.0.10 (Current)
- Added table prefix handling options (keep/remove/ask)
- Improved entity class generation with better comment support
- Optimized memory usage and performance
- Fixed database connection issues
- Enhanced error handling and user feedback

### 0.0.9
- Added support for table and column comments in entity generation
- Improved code generation formatting
- Fixed file generation without auto-opening
- Enhanced error handling and user feedback
- Updated dependencies and improved stability

### 0.0.8
- Added custom naming strategy support
- Improved template handling
- Fixed Windows path issues
- Enhanced error messages

### 0.0.7
- Added configuration options
- Improved code generation quality
- Fixed database connection issues

### 0.0.6
- Added jump functionality between Mapper interfaces and XML files
- Added CodeLens support for method navigation
- Improved error handling and logging
- Enhanced database connection management
- Added file decorations for Mapper files

### 0.0.5
- Added support for custom templates
- Improved code generation quality
- Fixed MySQL connection issues

### 0.0.4
- Added interactive table selection
- Improved package name handling
- Better error messages

### 0.0.3
- Added XML implementation generator
- Fixed file path issues on Windows
- Improved Java type mapping

### 0.0.2
- Added MySQL database support
- Improved error handling
- Better progress indication

### 0.0.1
Initial release with basic features:
- Database connection configuration
- Entity class generation
- Mapper interface generation
- XML mapping file generation

## Special Thanks

Special thanks to my beloved wife Su Jiao (苏娇). Her unwavering support, understanding, and encouragement made this project possible. This extension is dedicated to her endless love and patience during its development.

## Contributing

The source code for this extension is available on GitHub. Feel free to submit issues and pull requests.

## License

This extension is licensed under the MIT License.
