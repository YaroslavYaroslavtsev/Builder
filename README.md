<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Syntax](#syntax)
  - [Directives](#directives)
    - [@set](#@set)
    - [@macro](#@macro)
    - [@if – @elseif – @else](#@if-%E2%80%93-@elseif-%E2%80%93-@else)
    - [@{...} (inline expressions)](#@-inline-expressions)
    - [@error](#@error)
    - [@include](#@include)
      - [Macro](#macro)
      - [Local Files](#local-files)
      - [Remote Files](#remote-files)
      - [From Git Repository](#from-git-repository)
  - [Expressions](#expressions)
    - [Types](#types)
    - [Operators](#operators)
      - [Binary](#binary)
      - [Unary](#unary)
    - [Member Expressions](#member-expressions)
    - [Conditional Expressions](#conditional-expressions)
    - [Variables](#variables)
      - [\_\_LINE\_\_](#%5C_%5C_line%5C_%5C_)
      - [\_\_FILE\_\_](#%5C_%5C_file%5C_%5C_)
    - [Functions](#functions)
  - [Comments](#comments)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


<br /><img src=docs/logo.png?1 width=280 alt=Builder><br /><br />

_Builder_ language combines a preprocessor with an expression language and advanced imports.

_Please note that the works is in-progress and published for preview purposes only._

# Syntax

## Directives

Directives start with `@` symbol.

### @set

```
@set <variable:identifier> <value:expression>
```

```
@set <variable:identifier> = <value:expression>
```

Assigns a value of an _expression_ to a _variable_.

Variables are defined in a _global_ context.

Example:

_Sets SOMEVAR to 1:_

```
@set SOMEVAR min(1, 2, 3)
```

### @macro

```
@macro <name>(<arguments>)
  <body>
@endmacro
```

_`@end` directive can be used instead of `@endmacro`._

Declares a block of code that can take parameters and can be reused with an `@include` statement. Once declared macros

Variables declared as parameters are only available within the macro scope and override global variables with the same name (but do not affect them).

Example:

```
@macro some_macro(a, b, c)
  Hello, @{a}!
  Roses are @{b},
  And violets are @{defined(c) ? c : "of unknown color"}.
@end
```

Then `some_macro` can be used as:

```
@include some_macro("username", 123)
```

which will produce:

```
Hello, username!
Roses are red,
And violets are of unknown color.
```

### @if – @elseif – @else

Conditional directive.

```
@if <test:expression>

  // consequent code

@elseif <test:expression>

  else if #1 code

...more elseifs...

@else

  // alternate code

@endif
```

`@endif`can be replaced with `@end`.

Example:

```
@if __FILE__ == 'abc.ext'
  // include something
@elseif __FILE__ == 'def.ext'
  // include something else
@else
  // something completely different
@endif
```

### @{...} (inline expressions)

```
@{expression}
```

Inserts the value of the enclosed expression.

Example:

```
@set name "Someone"
Hello, @{name}, the result is: @{123 * 456}.
```

results in the following output:

```
Hello, Someone, the result is: 56088.
```

### @error

```
@error <message:expression>
````

Emits an error.

Example:

```
@if PLATFORM == "platform1"
  // platform 1 code
@elseif PLATFORM == "platform2"
  // platform 2 code
@elseif PLATFORM == "platform3"
  // platform 3 code
@else
  @error "Platform is " + PLATFORM + " is unsupported"
@endif
```

### @include

Includes local file, external source or a macro.

```
@include <source:expression>
```

#### Macro

```
@include some_macro("username", 123)
```

#### Local Files

```
@include "somefile.ext"
```

#### Remote Files

```
@include "http://example.com/file.ext"
```

```
@include "https://example.com/file.ext"
```

#### From Git Repository

```
@include "<repository_url>.git/<path>/<to>/<file>@<ref>"
```

For example, importing file from _GitHub_ looks like:

- Head of the default branch

  ```
  @include "https://github.com/electricimp/Builder.git/README.md"
  ```

- Head of the _master_ branch

  ```
  @include "https://github.com/electricimp/Builder.git/README.md@master"
  ```

- Tag _v1.2.3_:

  ```
  @include "https://github.com/electricimp/Builder.git/README.md@v1.2.3"
  ```

- Latest existing tag

  ```
  @include "https://github.com/electricimp/Builder.git/README.md@latest"
  ```

## Expressions

Directives that have parameters allow usage of _expression_ syntax.

For example:

- `@include <path:expression>`
- `@set <variable:identifier> <value:expression>`
- `@if <condition:expression>`
- `@elseif <condition:expression>`
- `@{expression}` (inline expressions)

### Types

The following types are supported in expressions:

- _numbers_ (eg: `1`,`1E6`, `1e-6`, `1.567`)
- _strings_ (eg: `"abc"`, `'abc'`)
- `null`
- `true`
- `false`

### Operators

#### Binary

`|| && == != < > <= >= + - * / %`

#### Unary

`+ - !`

### Member Expressions

- `somevar.member`
- `somevar["member"]`
- `([1, 2, 3])[1]`

### Conditional Expressions

`test ? consequent : alternate`

### Variables

- Variables defined by `@set` statements are available in expressions.
- Undefined variables are evaluated as `null`.
- Variable names can contain `$`, `_`, latin letters and digits and can start only with a non-digit.

#### \_\_LINE\_\_

Line number (relative to the file in which this variable appears).

Example:

```
Hi from line @{__LINE__}!
```

#### \_\_FILE\_\_

Name of the file in which this variable appears.

Example:

```
Hi from file @{__FILE__}!
```

### Functions

- `min(<numbers>)`
- `max(<numbers>)`
- `abs(<number>)`
- `defined(<variable_name>)` – returns `true` if _<variable_name>_ is defined or `false` otherwise.

## Comments

Directives can contain both `//`- and `/**/`-style comments.

# License

MIT
