# FROM openjdk:8-jre-alpine
FROM acrtddevdecisha01.azurecr.io/openjdk:8-jre-alpine
ADD target/*.jar app.jar
EXPOSE 8080

ENTRYPOINT ["java","-Djava.security.egd=file:/dev/./urandom","-javaagent:/agent.jar","-jar","/app.jar"]
