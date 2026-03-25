# soberania-multimedia

Local media server for personal movie collection.
No internet required, no subscriptions, total privacy.

## Stack

- **Jellyfin** — open source media server
- **Docker** — containerized deployment
- **Roku** — client devices (x2)

## Infrastructure

| Item | Value |
|---|---|
| Server | Ubuntu |
| IP | 192.168.1.77 (static) |
| Port | 8096 |
| Docker | 28.2.2 |
| Compose | 2.37.1 |

## Storage

| Item | Value |
|---|---|
| Drive | Seagate Backup Plus 4.5TB |
| Symlink | /mnt/biblioteca -> _biblioteca/ |
| Movies | 246 |

> Warning: The symlink is required because Docker cannot handle colons in volume paths.

## Library Structure

_biblioteca/
├── accion/
├── animacion/
├── aventura/
├── comedia/
├── crimen/
├── documental/
├── drama/
├── familia/
├── fantasia/
├── historia/
├── musica/
├── romance/
├── sci-fi/
├── terror/
├── thriller/
├── western/
└── sin-clasificar/

## Quick Start

Start:   docker compose up -d
Stop:    docker compose down
Restart: docker compose restart
Status:  docker ps

## Access

http://192.168.1.77:8096

## Systemd Services

Two services run automatically at boot:

biblioteca-symlink.service
- Creates /mnt/biblioteca symlink after drive mounts
- Safe if drive is not connected, skips silently

jellyfin-compose.service
- Starts Jellyfin via Docker Compose
- Runs after biblioteca-symlink.service

Check status:
  sudo systemctl status biblioteca-symlink.service | cat
  sudo systemctl status jellyfin-compose.service | cat

## Auto Shutdown

Server shuts down automatically at 3:00am every day.
View cron job: sudo crontab -l

## Subtitles

External Spanish subtitles (.es.srt) alongside each video file.
Jellyfin auto-selects Spanish by default.

## Related

- movie-organizer: https://github.com/vpeg49/movie-organizer
