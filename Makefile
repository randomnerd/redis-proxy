all: build test
build:
	docker-compose build
test:
	docker build . -f Dockerfile.test -t redis-proxy-test
	docker run --rm -it redis-proxy-test

