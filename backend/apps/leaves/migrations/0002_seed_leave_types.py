from django.db import migrations

LEAVE_TYPES = [("Annual", 18), ("Sick", 10), ("Casual", 7)]


def seed(apps, schema_editor):
    LeaveType = apps.get_model("leaves", "LeaveType")
    for name, days in LEAVE_TYPES:
        LeaveType.objects.get_or_create(name=name, defaults={"default_days": days})


def unseed(apps, schema_editor):
    LeaveType = apps.get_model("leaves", "LeaveType")
    LeaveType.objects.filter(name__in=[name for name, _ in LEAVE_TYPES]).delete()


class Migration(migrations.Migration):
    dependencies = [("leaves", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]