# Generated by Django 4.0.4 on 2022-11-04 10:00

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('youtube', '0003_rename_playlistsrecords_playlistsrecord'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChannelsRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel_id', models.CharField(max_length=1024, unique=True)),
                ('channel_title', models.CharField(max_length=1024, unique=True)),
                ('channel_credentials', models.TextField(default='')),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'channels_records',
            },
        ),
    ]
