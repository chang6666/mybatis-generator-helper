# MyBatis Generator Extension

A Visual Studio Code extension that generates MyBatis entities, mappers, and XML files from your database schema.

## Features

- Generate Java entity classes from database tables
- Generate MyBatis mapper interfaces
- Generate MyBatis XML mapping files
- Support for MySQL databases
- Interactive table selection
- Customizable package names and output directories

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

## Extension Settings

This extension does not add any VS Code settings yet.

## Known Issues

None reported.

## Release Notes

### 0.0.1

Initial release with basic features:
- Database connection configuration
- Entity class generation
- Mapper interface generation
- XML mapping file generation

## Contributing

The source code for this extension is available on GitHub. Feel free to submit issues and pull requests.

## License

This extension is licensed under the MIT License.
