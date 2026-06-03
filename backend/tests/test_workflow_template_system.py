import pytest

from app.harness.workflow_template_system import CompositeWorkflowTemplate


class DummySystem:
    def __init__(self, templates):
        self._templates = templates

    def lookup(self, name):
        if name not in self._templates:
            raise KeyError(name)
        return self._templates[name]


def test_composite_workflow_template():
    templates = {
        "root": "---\nname: root\n---\nHello {{template:child1}}! We also have {{var1}}.",
        "child1": "Beautiful {{template:child2}}",
        "child2": "---\nname: child2\n---\nWorld",
    }
    system = DummySystem(templates)
    composite = CompositeWorkflowTemplate(system, "root")

    result = composite.render(var1="Magic")
    assert result == "Hello Beautiful World! We also have Magic."


def test_composite_circular_dependency():
    templates = {"a": "{{template:b}}", "b": "{{template:a}}"}
    system = DummySystem(templates)
    composite = CompositeWorkflowTemplate(system, "a")

    with pytest.raises(ValueError, match="Circular dependency detected"):
        composite.render()
