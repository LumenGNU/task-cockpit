# Поведение VS Code при разрешении задачи в случае коллизий имен


Задачи запускаются стандартными средствами VS Code.

Обозначения:

> ‣ task_label (task_description)

Лейбл пункта выбора задачи в палитре задач, так, как показывает VS Code.


## Single-folder коллизии в пределах одной области


### single-folder-conflicts-within-single-scope/.vscode/tasks.json

~~~json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'My Task 1'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "My Task",
            "command": "echo 'My Task 2'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "My Task",
            "command": "echo 'My Task 3'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn My Task",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

### VS Code UI

Отображает три независимых пункта "My Task":

- ‣ DependsOn My Task
- ‣ My Task
- ‣ My Task
- ‣ My Task


### Выполнение

**"My Task"**:

При запуске любого из трех "My Task":

- ‣ My Task
  ~~~
   *  Executing task: echo 'My Task 3'

  My Task 3
  ~~~

**"DependsOn"**:

- ‣ DependsOn My Task
  ~~~
   *  Executing task: echo 'My Task 1'

  My Task 1
  ~~~


## Single-folder коллизии с User level


### User/profiles/.../tasks.json

~~~json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        }
    ]
}
~~~

### single-folder-conflicts-between-user-level/.vscode/tasks.json

~~~json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'project level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn My Task",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

### VS Code UI

- ‣ DependsOn My Task
- ‣ My Task
- ‣ My Task (User)

### Выполнение

**"My Task"**:

- ‣ My Task (User)
  ~~~
   *  Executing task: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task
  ~~~
   *  Executing task: echo 'user level My Task'

  user level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn My Task
  ~~~
   *  Executing task: echo 'project level My Task'

  project level My Task
  ~~~


## Multi-root коллизии между областями


### Сценарий 1

- User-версия "My Task" присутствует
- Workspace-версия "My Task" присутствует
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-scopes-s1/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-scopes-s1/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s1/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

В пикере присутствуют все задачи, для каждой в description есть ее scope:
User, project.code-workspace, folder1 и folder2.

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ My Task (project.code-workspace)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)

#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~


**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

Результат стабильный и не зависит от порядка выполнения.


### Сценарий 2

- User-версия "My Task" присутствует
- Workspace-версия "My Task" присутствует
- Без folder1-версии "My Task"
- Без folder2-версии "My Task"


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-scopes-s2/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-scopes-s2/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s2/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (project.code-workspace)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)


#### Выполнение


**"My Task"**:

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
~~~
Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../folder2'
~~~


### Сценарий 3

- User-версия "My Task" присутствует
- Без Workspace-версии "My Task"
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s3/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-scopes-s3/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s3/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)


#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../project.code-workspace'
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~


### Сценарий 4

- User-версия "My Task" присутствует
- Без Workspace-версии "My Task"
- Без folder1-версии "My Task"
- Без folder2-версии "My Task"


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-scopes-s4/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-scopes-s4/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s4/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)


#### Выполнение


**"My Task"**:

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../project.code-workspace'
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../folder2'
  ~~~



### Сценарий 5

- Без User-версии "My Task"
- Workspace-версия "My Task" присутствует
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-scopes-s5/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-scopes-s5/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s5/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ My Task (project.code-workspace)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)


#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'settings'
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~


### Сценарий 6

- Без User-версии "My Task"
- Workspace-версия "My Task" присутствует
- Без folder1-версии "My Task"
- Без folder2-версии "My Task"


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-scopes-s6/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-scopes-s6/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s6/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (project.code-workspace)
- ‣ DependsOn 'My Task' in folder2 (folder2)


#### Выполнение


**"My Task"**:

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'settings'
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../folder2'
  ~~~



### Сценарий 7

- Без User-версии "My Task"
- Без Workspace-версии "My Task"
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует

#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-scopes-s7/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-scopes-s7/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-scopes-s7/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)

#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'settings'
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../project.code-workspace'
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~





## Выводы

### Концепция: Prima

*Прима* (`Prima`) — это каталог, который в multi‑root является первым каталогом проекта, а в single‑folder — единственным. Prima имеет особое положение.

### Правила запуска

#### "Прямой" запуск

> VS Code не запускает конкретный экземпляр, выбранный в пикере. Она разрешает задачу заново, по глобальному приоритету.
>
> Задачи из `User`, `Workspace` и `Prima` конкурируют по единому глобальному приоритету `User` > `Workspace` > `Prima` — независимо от того, какой экземпляр выбран в пикере.

Это значит: если ты кликаешь на "‣ My Task (project.code-workspace)", а в `User` тоже есть "My Task" — запустится User-версия. Метка "(project.code-workspace)" в пикере декоративна.

~~~
Сценарий | Где "My Task" определен | Что запускается при клике на 'My Task'
         |                        | -----------------------------------------
         |                        |  U  |  W  |  P
---------|------------------------|-----|-----|------------------------------
Сц. 1    |   +U +W +P             |  U  |  U  |  U
Сц. 2    |   +U +W -P             |  U  |  U  |  -
Сц. 3    |   +U -W +P             |  U  |  -  |  U
Сц. 4    |   +U -W -P             |  U  |  -  |  -
Сц. 5    |   -U +W +P             |  -  |  W  |  W
Сц. 6    |   -U +W -P             |  -  |  W  |  -
Сц. 7    |   -U -W +P             |  -  |  -  |  P
~~~

> - U — User level
> - W — Workspace level
> - P — folder1 (Prima) level

`Folder2` всегда запускает только свою собственную задачу — без исключений (Сц. 1, 3, 5, 7).

> Задачи из `folder[1+]` (не `Prima`) запускают исключительно свою версию задачи.

#### Запуск как зависимость

> Разрешение определяется **областью родительской задачи**:
> - `User` поиск зависимости ограничен `User`
> - `Workspace` поиск зависимости ограничен `Workspace`
> - `Prima` поиск зависимости `Prima` → `Workspace` → `User` (каскад при отсутствии)
> - `folder[1+]` поиск зависимости ограничен "своей" областью

~~~
Сценарий | Где "My Task" определен | Что запускается при клике на DependsOn in (X)
         |                         | ---------------------------------------------
         |                         |  U  |  W  |  P
---------|-------------------------|-----|-----|----------------------------------
Сц. 1    |   +U +W +P              |  U  |  W  |  P
Сц. 2    |   +U +W -P              |  U  |  W  |  W
Сц. 3    |   +U -W +P              |  U  | err |  P
Сц. 4    |   +U -W -P              |  U  | err |  U
Сц. 5    |   -U +W +P              | err |  W  |  P
Сц. 6    |   -U +W -P              | err |  W  |  W
Сц. 7    |   -U -W +P              | err | err |  P
~~~

> - U — User level
> - W — Workspace level
> - P — folder1 (Prima) level

`Folder2` запускает только если зависимость доступна в ее области (Сц. 1, 3, 5, 7). Ошибка — в противоположном случае (Сц. 2, 4, 6).

##### Асимметрия

`User`, `Workspace` и `folder[n+1]` "смотрят только на себя". Только `Prima` обладает каскадным поведением — видимо, VS Code рассматривает первый каталог как "каталог со специальными правилами" — папку, которая наследует конфигурацию.

#### Коллизии внутри одной области

Когда в одной области несколько задач с одинаковым именем:

**Прямой запуск**: Побеждает задача **последняя по порядку в файле**.

**Как зависимость**: Побеждает задача **первая по порядку в файле**.

## Ремарка

Протестировано, но не задокументировано подробно — поведение тривиально:

- `Prima` определяется индексом 0 в `workspace.workspaceFolders` (он же порядок в проводнике; первая из "folders" в .code-workspace).
- `folder[1+]` — все папки с индексом ≥ 1 ведут себя одинаково.
- Коллизии внутри области работают по одним и тем же правилам независимо от области.
- "dependsOn" принимает только string | string[] — объектной адресации не существует (ITaskIdentifier не является адресом задачи. Это структурный идентификатор задачи, который используется для сопоставления task definition ("что", а не "где". То есть через dependsOn нельзя выразить: «возьми задачу blah именно из folder3»).


----

## Если кратко:

В документе задокументировано неочевидное и местами противоречивое поведение VS Code при разрешении задач с одинаковым именем (label) в разных областях (user, workspace, папки проекта).

Главное: правила зависят не только от того, где задача определена, но и от того, как она запускается (прямой запуск или как зависимость через dependsOn), а также от особого статуса первой папки multi-root-проекта, названной здесь «Prima».

Суть: когда вы видите в списке задач пункт "My Task (project.code-workspace)", вы ожидаете, что запустится именно workspace-версия. Но VS Code игнорирует выбранный пункт и переразрешает задачу заново по собственным глобальным правилам. А при использовании `dependsOn` правила становятся ещё более запутанными.

**Правила прямого запуска (Run Task)**:

1. Для папок, не являющихся первой (folder2, folder3 …)

    Если задача определена в такой папке, при клике на неё всегда выполняется строго своя локальная версия. Глобальные задачи с таким же именем из User или Workspace полностью игнорируются. Если локальной задачи нет, соответствующий пункт в интерфейсе просто отсутствует.

2. Для первой папки («Prima»)

    Здесь работает глобальный приоритет: User → Workspace → Prima.

    Даже если в Prima есть собственная задача, при клике на "My Task (folder1)" выполнится User-версия, если она существует. Если User-версии нет, но есть Workspace — выполнится Workspace. Только при отсутствии и User, и Workspace-версии запустится локальная задача из Prima.

3. Для User и Workspace

    При клике на "My Task (User)" или "My Task (Workspace)" работает тот же глобальный приоритет: User главнее Workspace, Workspace главнее Prima. То есть метка (Workspace) декоративна, если есть User-задача с тем же именем.

Вывод: в multi-root прямой запуск для первой папки всегда проигрывает более глобальным определениям, а для остальных папок — полностью изолирован. В single-folder проекте единственная папка ведёт себя как Prima.

**Правила разрешения зависимостей (`dependsOn`)**:

Здесь поведение становится противоположным: поиск задачи-зависимости жёстко привязан к области родительской задачи.

1. Родитель в User

    Поиск зависимости строго внутри User. Если там нет задачи с нужным именем — ошибка, даже если она есть в Workspace или папках.

2. Родитель в Workspace

    Поиск строго внутри Workspace. При отсутствии — ошибка, каскада к User или папкам нет.

3. Родитель в папке, не являющейся первой (folder2, folder3 …)

    Поиск строго внутри этой же папки. Нет локальной задачи — ошибка.

4. Родитель в первой папке (Prima) — исключение

    Только здесь действует каскад:
    Сначала ищется задача в Prima → если нет, то в Workspace → если нет, то в User.

    То есть Prima «наследует» зависимости из более глобальных скоупов, если не имеет своей. Все остальные скоупы полностью изолированы при резолвинге dependsOn.

**Коллизии внутри одной области** (несколько задач с одинаковым label в одном файле)

Прямой запуск: побеждает последняя по порядку определения в файле.

Использование как зависимости: побеждает первая по порядку.

Это различие прямо противоположно и подтверждает, что резолвинг идёт двумя разными путями.

VS Code не даёт пользователю прямого контроля над тем, какая именно задача выполнится при совпадении имён. Метки в списке задач ((User), (Workspace), (folder)) могут вводить в заблуждение, а поведение зависит от неочевидных факторов. Единственный надёжный способ избежать сюрпризов — использовать уникальные имена задач во всех скоупах, особенно если применяется dependsOn или работа идёт в multi-root-окружении.

-----

## Анализ от LLM

Claude: Теперь у меня есть полная картина. Всё сходится. Излагаю по механизмам.

https://github.com/microsoft/vscode/

### Механизм 1: изоляция `dependsOn` — `TaskDependency.uriFromSource`

`taskConfiguration.ts:1325–1330`

~~~
function uriFromSource(context: IParseContext, source: TaskConfigSource): URI | string {
    switch (source) {
        case TaskConfigSource.User: return Tasks.USER_TASKS_GROUP_KEY;
        case TaskConfigSource.TasksJson: return context.workspaceFolder.uri;
        default: return context.workspace && context.workspace.configuration
            ? context.workspace.configuration : context.workspaceFolder.uri;
    }
}
~~~

При парсинге `dependsOn: "My Task"` в каждой задаче VS Code кодирует, где искать, в dependency.uri:

- User → строка-константа `USER_TASKS_GROUP_KEY` ("settings")
- `.vscode/tasks.json` → URI папки этого файла
- `.code-workspace` → URI самого workspace-файла

Резолвер потом ищет именно по этому ключу. Отсюда изоляция — каждый скоуп видит только себя.

### Механизм 2: почему Prima видит всё — `_getAFolder()`

`abstractTaskService.ts:2579–2586`

~~~
private async _getAFolder(): Promise<IWorkspaceFolder> {
    let folder = this.workspaceFolders.length > 0 ? this.workspaceFolders[0] : undefined;
    // ...
    return folder;
}
~~~

User-задачи и workspace-файл-задачи парсятся с `workspaceFolder = _getAFolder() = folder1 (Prima)`. Это записывается в `_source.config.workspaceFolder`. В итоге `task.getWorkspaceFolder()` для user-задачи возвращает folder1.

### Механизм 3: каскад Prima — `_createResolver.quickResolve`

`abstractTaskService.ts:1971–1993`

~~~
async function quickResolve(that, uri, identifier) {
    const foundTasks = await that._findWorkspaceTasks((task) => {
        const taskUri = ((ConfiguringTask.is(task) || CustomTask.is(task))
            ? task._source.config.workspaceFolder?.uri : undefined);
        const originalUri = typeof uri === 'string' ? uri : uri.toString();
        if (taskUri?.toString() !== originalUri) { return false; }
        return task._label === identifier || task.configurationProperties.identifier === identifier;
    });
    // ...
    return foundTasks[0];  // первая найденная
}
~~~

Когда Prima делает `dependsOn`, `dependency.uri = folder1_uri`. `quickResolve` ищет задачи по `task._source.config.workspaceFolder?.uri === folder1_uri`. Попадают все, у кого `workspaceFolder = folder1` — то есть сама Prima-задача, workspace-задача и user-задача (все три парсились с `workspaceFolder = folder1`).

`_findWorkspaceTasks` итерирует в порядке insertion в `_computeWorkspaceTasks`:

~~~
folder1_uri → folder2_uri → workspace_config → USER_TASKS_GROUP_KEY
~~~

`foundTasks[0]` = первая найденная = **folder1** если есть → **workspace** если нет → **user** — каскад без sort.

> Prima не «наследует» Workspace/User как концептуальную семантику.
> Она оказывается общей workspaceFolder-областью для задач, которые VS Code искусственно > вычисляет через первую workspace folder.
>
> Это workspace folder, которую VS Code использует как synthetic context для источников, не принадлежащих конкретной workspace folder.

### Механизм 4: "переразрешение" при прямом запуске — `_executeTask → getTask`

`abstractTaskService.ts:2075–2087`

~~~
private async _executeTask(task: Task, resolver, runSource) {
    let taskToRun = task;
    if (await this._saveBeforeRun()) {  // по умолчанию saveBeforeRun = "always" → true
        await this._updateWorkspaceTasks();
        const taskFolder = task.getWorkspaceFolder();  // для User/Workspace задач → folder1!
        const taskIdentifier = task.configurationProperties.identifier;
        taskToRun = (await this.getTask(taskFolder, taskIdentifier, ...)) ?? task;
    }
~~~

Поскольку `task.saveBeforeRun` по умолчанию `"always"`, задача **всегда переразрешается** через `getTask(task.getWorkspaceFolder(), identifier)`. Для User-задачи и Workspace-задачи `getWorkspaceFolder() = folder1` — потому что они парсились с `workspaceFolder = folder1`. (WYSIWYG не работает).

`abstractTaskService.ts:970–978`

~~~
const matchedTasks = await this._findWorkspaceTasks((task, workspaceFolder) => {
    const taskFolder = TaskMap.getKey(workspaceFolder);
    if (taskFolder !== requestedFolder && taskFolder !== USER_TASKS_GROUP_KEY) {
        return false;
    }
    return task.matches(key, compareId);
});
matchedTasks.sort(task => task._source.kind === TaskSourceKind.Extension ? 1 : -1);
~~~

`_findWorkspaceTasks` передаёт `workspaceTasks.workspaceFolder` — а для user/workspace задач это folder1 (из `IWorkspaceFolderTaskResult.workspaceFolder`). Значит `TaskMap.getKey(folder1) = folder1_uri = requestedFolder` → все три (folder1, workspace, user) попадают в `matchedTasks`.

Дальше — сортировка с **некорректным comparator** `task => -1` (принимает один аргумент вместо двух). Для non-extension задач compareFn(a, b) всегда возвращает -1 ("a < b"). Insertion sort с таким компаратором реверсирует массив:

~~~
[folder1_task, workspace_task, user_task] → [user_task, workspace_task, folder1_task]
~~~

`matchedTasks[0] = user_task`. Запускается user-версия. Приоритет User > Workspace > Prima — побочный эффект баговатого sort.

folder2 при этом избегает переразрешения: `task.getWorkspaceFolder() = folder2` → `getTask(folder2, ...)` → matchedTasks содержит только folder2_task → запускается folder2-версия.

-----

Итого: карта по файлам


| Поведение                   | Файл                     | Строки    | Механизм                                           |
|-----------------------------|--------------------------|-----------|----------------------------------------------------|
| Изоляция `dependsOn`        | `taskConfiguration.ts`   | 1325–1330 | `uriFromSource` жёстко кодирует URI поиска         |
| Prima = folder1             | `abstractTaskService.ts` | 2579–2586 | `_getAFolder()` → `workspaceFolders[0]`            |
| Каскад Prima                | `abstractTaskService.ts` | 1971–1993 | `quickResolve` по `_source.config.workspaceFolder` |
| Переразрешение при запуске  | `abstractTaskService.ts` | 2075–2087 | `saveBeforeRun=always` → `getTask(folder1, id)`    |
| Приоритет User > WS > Prima | `abstractTaskService.ts` | 970–978   | баговый sort реверсирует matchedTasks              |


-----

https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/contrib/tasks/common/taskConfiguration.ts
