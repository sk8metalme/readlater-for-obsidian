# Tasks Document

<!-- AI Instructions: For each task, generate a _Prompt field with structured AI guidance following this format:
_Prompt: Role: [specialized developer role] | Task: [clear task description with context references] | Restrictions: [what not to do, constraints] | Success: [specific completion criteria]_
This helps provide better AI agent guidance beyond simple "work on this task" prompts. -->

- [x] 1. Create AggregatedFileManager class in src/lib/aggregated-file-manager.js
  - File: src/lib/aggregated-file-manager.js
  - Implement core aggregated file operations class
  - Add file reading, parsing, and updating methods
  - Purpose: Provide central management for aggregated markdown files
  - _Leverage: src/lib/markdown-generator.js, src/utils/error-handler.js_
  - _Requirements: 1.1, 1.3_
  - _Prompt: Role: Backend Developer specializing in file operations and Chrome Extension APIs | Task: Create AggregatedFileManager class handling aggregated markdown file operations following requirements 1.1 and 1.3, leveraging existing patterns from src/lib/markdown-generator.js and error handling from src/utils/error-handler.js | Restrictions: Must follow existing Chrome Extension patterns, do not bypass error handling utilities, maintain compatibility with Native Messaging API | Success: Class implements file reading/writing operations correctly, proper error handling integrated, follows existing architecture patterns_

- [x] 2. Create ArticleTableManager utility in src/lib/article-table-manager.js
  - File: src/lib/article-table-manager.js
  - Implement markdown table generation and manipulation
  - Add methods for table headers, row formatting, and updates
  - Purpose: Handle article listing table in aggregated files
  - _Leverage: src/lib/markdown-generator.js_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Role: Frontend Developer with expertise in data formatting and Markdown generation | Task: Create ArticleTableManager for markdown table operations following requirements 2.1 and 2.2, extending patterns from src/lib/markdown-generator.js | Restrictions: Must generate valid Markdown table syntax, ensure consistent formatting, do not hardcode table structure | Success: Table generation works correctly, supports dynamic columns, handles special characters properly in table cells_

- [x] 3. Create AggregatedMarkdownGenerator class in src/lib/aggregated-markdown-generator.js
  - File: src/lib/aggregated-markdown-generator.js
  - Implement aggregated file markdown structure generation
  - Add content merging and template management
  - Purpose: Generate complete aggregated markdown files with proper structure
  - _Leverage: src/lib/markdown-generator.js, src/lib/article-table-manager.js_
  - _Requirements: 3.1, 3.2_
  - _Prompt: Role: Full-stack Developer with expertise in content management and template systems | Task: Implement AggregatedMarkdownGenerator for complete markdown file generation following requirements 3.1 and 3.2, integrating MarkdownGenerator and ArticleTableManager | Restrictions: Must maintain markdown validity, ensure proper content structure, do not duplicate existing markdown generation logic | Success: Generates properly structured aggregated files, integrates table and content correctly, maintains markdown formatting standards_

- [x] 4. Add aggregated file settings to Options Page in src/options/options.js
  - File: src/options/options.js (modify existing)
  - Add UI controls for aggregation settings (enable/disable, filename)
  - Implement settings persistence with Chrome Storage API
  - Purpose: Allow users to configure aggregated saving behavior
  - _Leverage: existing settings management in src/options/options.js_
  - _Requirements: 4.1, 4.2_
  - _Prompt: Role: Frontend Developer specializing in Chrome Extension options and settings management | Task: Add aggregated file settings UI following requirements 4.1 and 4.2, extending existing options page patterns and Chrome Storage integration | Restrictions: Must follow existing UI patterns, maintain settings persistence reliability, do not break existing option functionality | Success: Settings UI is intuitive and functional, settings persist correctly, integrates seamlessly with existing options page_

- [x] 5. Update Options Page HTML/CSS in src/options/options.html and src/options/options.css
  - File: src/options/options.html, src/options/options.css (modify existing)
  - Add aggregation settings form elements
  - Style new settings to match existing design
  - Purpose: Provide user interface for aggregation configuration
  - _Leverage: existing styling patterns in src/options/options.css_
  - _Requirements: 4.1_
  - _Prompt: Role: UI/UX Developer with expertise in Chrome Extension interfaces and responsive design | Task: Add aggregation settings form elements following requirement 4.1, maintaining design consistency with existing options page styling | Restrictions: Must match existing visual design, ensure form accessibility, do not break existing layout | Success: New settings form integrates visually with existing design, is accessible and responsive, maintains usability standards_

- [x] 6. Modify Service Worker to support aggregated saving in src/background/service-worker.js
  - File: src/background/service-worker.js (modify existing)
  - Add aggregation mode detection and routing logic
  - Integrate AggregatedFileManager for aggregated saves
  - Purpose: Route article saves to appropriate handler based on settings
  - _Leverage: existing save logic, src/lib/aggregated-file-manager.js_
  - _Requirements: 1.1, 5.1_
  - _Prompt: Role: Chrome Extension Developer with expertise in Service Workers and background processing | Task: Modify existing Service Worker to support aggregated saving following requirements 1.1 and 5.1, integrating AggregatedFileManager while maintaining existing functionality | Restrictions: Must not break existing save functionality, maintain Chrome Extension API compliance, ensure proper error handling | Success: Service Worker correctly routes to aggregated or individual saving based on settings, maintains all existing functionality, proper integration with new aggregation classes_

- [x] 7. Create aggregated file template structure
  - File: Create template logic within AggregatedMarkdownGenerator
  - Define standard aggregated file markdown structure
  - Add table of contents and article sections
  - Purpose: Establish consistent aggregated file format
  - _Leverage: src/lib/markdown-generator.js templates_
  - _Requirements: 2.1, 3.1_
  - _Prompt: Role: Technical Writer with expertise in content structure and Markdown templates | Task: Design aggregated file template structure following requirements 2.1 and 3.1, extending existing template patterns from src/lib/markdown-generator.js | Restrictions: Must maintain markdown validity, ensure consistent structure, do not complicate existing template system | Success: Template structure is logical and consistent, supports table and content sections, integrates well with existing markdown generation_

- [x] 8. Add data models for aggregated articles
  - File: Update existing classes with aggregated data structures
  - Define AggregatedFileData and Article data models
  - Add validation and serialization methods
  - Purpose: Ensure consistent data handling for aggregated files
  - _Leverage: existing data patterns in src/lib/markdown-generator.js_
  - _Requirements: All data model requirements_
  - _Prompt: Role: Data Architect with expertise in JavaScript object modeling and validation | Task: Define and implement data models for aggregated articles following all data model requirements, extending existing patterns from src/lib/markdown-generator.js | Restrictions: Must maintain data consistency, ensure proper validation, do not break existing data structures | Success: Data models are well-defined and validated, serialization works correctly, integrates with existing data handling patterns_

- [x] 9. Implement error handling for aggregated operations
  - File: Extend src/utils/error-handler.js if needed, integrate throughout aggregated classes
  - Add specific error handling for file conflicts, parsing errors
  - Implement fallback mechanisms for aggregated save failures
  - Purpose: Ensure robust error handling for aggregated file operations
  - _Leverage: src/utils/error-handler.js_
  - _Requirements: All error handling requirements_
  - _Prompt: Role: DevOps Engineer with expertise in error handling and system reliability | Task: Implement comprehensive error handling for aggregated operations following all error handling requirements, leveraging existing error handling from src/utils/error-handler.js | Restrictions: Must use existing error handling patterns, ensure graceful degradation, do not suppress important errors | Success: All error scenarios are handled gracefully, fallback mechanisms work correctly, error messages are user-friendly and informative_

- [x] 10. Create unit tests for AggregatedFileManager in tests/lib/aggregated-file-manager.test.js
  - File: tests/lib/aggregated-file-manager.test.js
  - Write comprehensive tests for file operations
  - Test error scenarios and edge cases
  - Purpose: Ensure reliability of aggregated file operations
  - _Leverage: tests/setup.js, existing test patterns_
  - _Requirements: 1.1, 1.3_
  - _Prompt: Role: QA Engineer with expertise in JavaScript testing and file operation testing | Task: Create comprehensive unit tests for AggregatedFileManager following requirements 1.1 and 1.3, using existing test setup and patterns | Restrictions: Must test both success and failure scenarios, ensure test isolation, do not test external dependencies directly | Success: All file operations are thoroughly tested, edge cases covered, tests run reliably and independently_

- [x] 11. Create unit tests for ArticleTableManager in tests/lib/article-table-manager.test.js
  - File: tests/lib/article-table-manager.test.js
  - Write tests for table generation and formatting
  - Test markdown table validity and special character handling
  - Purpose: Ensure table generation reliability and format correctness
  - _Leverage: tests/setup.js_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Role: QA Engineer specializing in data formatting and content testing | Task: Create unit tests for ArticleTableManager table generation following requirements 2.1 and 2.2, ensuring markdown validity and special character handling | Restrictions: Must validate markdown table syntax, test edge cases with special characters, ensure consistent formatting | Success: Table generation is thoroughly tested, markdown validity confirmed, special characters handled correctly_

- [x] 12. Create integration tests for complete aggregated save flow in tests/integration/aggregated-save.test.js
  - File: tests/integration/aggregated-save.test.js
  - Test end-to-end aggregated article saving
  - Verify settings integration and file operations
  - Purpose: Ensure complete aggregated saving workflow functions correctly
  - _Leverage: tests/setup.js, manual test patterns from tests/manual/_
  - _Requirements: All requirements_
  - _Prompt: Role: QA Automation Engineer with expertise in integration testing and Chrome Extension testing | Task: Create comprehensive integration tests for aggregated save flow covering all requirements, leveraging existing test setup and manual test patterns | Restrictions: Must test real workflows, ensure proper setup and teardown, do not test external services directly | Success: Complete save workflow is tested end-to-end, all integrations work correctly, tests are reliable and maintainable_

- [x] 13. Update project documentation
  - File: Update README.md and docs/
  - Document new aggregated saving feature
  - Add configuration instructions and examples
  - Purpose: Provide clear documentation for users and developers
  - _Leverage: existing documentation patterns_
  - _Requirements: All requirements for user understanding_
  - _Prompt: Role: Technical Writer with expertise in software documentation and user guides | Task: Update project documentation to include aggregated saving feature covering all user-facing requirements, following existing documentation patterns | Restrictions: Must maintain documentation consistency, ensure clarity for end users, do not over-complicate instructions | Success: Documentation is clear and comprehensive, users can easily understand and configure the new feature, developer documentation supports maintenance_

- [x] 14. Final integration and testing
  - File: Complete system integration across all modified files
  - Perform comprehensive testing of both individual and aggregated modes
  - Verify backward compatibility and settings migration
  - Purpose: Ensure complete feature integration without breaking existing functionality
  - _Leverage: All created components and existing codebase_
  - _Requirements: All requirements including compatibility_
  - _Prompt: Role: Senior Software Engineer with expertise in system integration and feature rollout | Task: Complete final integration of aggregated saving feature ensuring all requirements are met while maintaining backward compatibility and existing functionality | Restrictions: Must not break any existing features, ensure smooth user experience transition, maintain all existing Chrome Extension functionality | Success: Feature is fully integrated and functional, existing functionality preserved, user experience is seamless for both modes, all tests pass_