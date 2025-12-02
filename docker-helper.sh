#!/bin/bash

# Docker Helper Script for LLM Brand Visibility Tracking
# Usage: ./docker-helper.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}===================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_env() {
    if [ ! -f .env ]; then
        print_warning ".env file not found!"
        echo "Creating .env from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env and add your API keys before starting!"
        exit 1
    fi
}

# Commands
case "$1" in
    start)
        print_header "Starting Docker Services"
        check_env
        docker compose up -d
        print_success "Services started!"
        echo ""
        echo "Access your services:"
        echo "  Frontend: http://localhost:80"
        echo "  Backend API: http://localhost:3000"
        echo "  RedisInsight: http://localhost:5540"
        ;;
    
    stop)
        print_header "Stopping Docker Services"
        docker compose down
        print_success "Services stopped!"
        ;;
    
    restart)
        print_header "Restarting Docker Services"
        docker compose restart
        print_success "Services restarted!"
        ;;
    
    build)
        print_header "Building Docker Images"
        check_env
        docker compose build --no-cache
        print_success "Build completed!"
        ;;
    
    rebuild)
        print_header "Rebuilding and Starting Services"
        check_env
        docker compose up -d --build
        print_success "Services rebuilt and started!"
        ;;
    
    logs)
        print_header "Viewing Logs (Ctrl+C to exit)"
        if [ -z "$2" ]; then
            docker compose logs -f
        else
            docker compose logs -f "$2"
        fi
        ;;
    
    status)
        print_header "Service Status"
        docker compose ps
        ;;
    
    clean)
        print_header "Cleaning Up (removes containers and volumes)"
        read -p "Are you sure? This will delete all data! (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose down -v
            print_success "Cleanup completed!"
        else
            print_warning "Cleanup cancelled"
        fi
        ;;
    
    reset)
        print_header "Full Reset (removes everything)"
        read -p "Are you sure? This will delete all containers, images, and data! (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose down -v
            docker system prune -a -f
            print_success "Full reset completed!"
        else
            print_warning "Reset cancelled"
        fi
        ;;
    
    shell)
        if [ -z "$2" ]; then
            print_error "Please specify a service: backend, frontend, mongodb, or redis"
            exit 1
        fi
        
        case "$2" in
            backend)
                docker compose exec backend sh
                ;;
            frontend)
                docker compose exec frontend sh
                ;;
            mongodb)
                docker compose exec mongodb mongosh -u root -p password
                ;;
            redis)
                docker compose exec redis redis-cli
                ;;
            *)
                print_error "Unknown service: $2"
                exit 1
                ;;
        esac
        ;;
    
    cli)
        print_header "Running Backend CLI"
        shift
        docker compose exec backend node cli.js "$@"
        ;;
    
    health)
        print_header "Health Check"
        echo "Backend API:"
        curl -s http://localhost:3000/health | jq . || echo "Backend not responding"
        echo ""
        echo "Frontend:"
        curl -s -o /dev/null -w "%{http_code}" http://localhost:80/health
        echo ""
        ;;
    
    setup)
        print_header "Initial Setup"
        
        # Check if .env exists
        if [ ! -f .env ]; then
            cp .env.example .env
            print_warning ".env created from .env.example"
            print_warning "Please edit .env and add your API keys!"
            read -p "Press enter after adding your API keys..."
        fi
        
        # Build and start
        docker compose up -d --build
        
        print_success "Setup completed!"
        echo ""
        echo "Services are starting..."
        echo "Wait a few seconds, then access:"
        echo "  Frontend: http://localhost:80"
        echo "  Backend API: http://localhost:3000"
        echo "  RedisInsight: http://localhost:5540"
        ;;
    
    *)
        echo "LLM Brand Visibility Tracking - Docker Helper"
        echo ""
        echo "Usage: ./docker-helper.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup       - Initial setup (create .env, build, start)"
        echo "  start       - Start all services"
        echo "  stop        - Stop all services"
        echo "  restart     - Restart all services"
        echo "  build       - Build images without cache"
        echo "  rebuild     - Rebuild and restart services"
        echo "  logs [svc]  - View logs (optionally for specific service)"
        echo "  status      - Show service status"
        echo "  clean       - Stop and remove containers + volumes"
        echo "  reset       - Full reset (removes everything)"
        echo "  shell <svc> - Open shell in service (backend|frontend|mongodb|redis)"
        echo "  cli [args]  - Run backend CLI commands"
        echo "  health      - Check service health"
        echo ""
        echo "Examples:"
        echo "  ./docker-helper.sh setup"
        echo "  ./docker-helper.sh logs backend"
        echo "  ./docker-helper.sh shell mongodb"
        echo "  ./docker-helper.sh cli list-runs"
        echo ""
        exit 0
        ;;
esac
