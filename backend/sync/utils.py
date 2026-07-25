from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID


def to_primitive(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    return value


def serialize_instance(instance) -> dict:
    data: dict[str, object] = {}
    for field in instance._meta.get_fields():
        if field.auto_created and not field.concrete:
            continue
        if field.many_to_many and not field.auto_created:
            manager = getattr(instance, field.name)
            data[field.name] = [to_primitive(pk) for pk in manager.values_list("pk", flat=True)]
            continue
        if not getattr(field, "concrete", False):
            continue

        value = getattr(instance, field.name)
        if getattr(field, "is_relation", False):
            data[field.name] = to_primitive(value.pk) if value else None
        else:
            data[field.name] = to_primitive(value)
    return data
