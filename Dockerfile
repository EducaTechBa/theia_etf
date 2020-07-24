FROM node:10.21.0

# Do package update and dependency instalation
RUN apt -y update
RUN apt -y install vim curl git build-essential gdb sudo
RUN npm install -g yo generator-theia-extension

# Add User
ENV USER=theia
ENV GROUP=theia
ENV HOME=/home/${USER}
ENV PASSWORD=theia

RUN mkdir -p ${HOME}
RUN groupadd -r ${GROUP} && \
    useradd -r -g ${GROUP} -d ${HOME} -s /sbin/nologin -c "Docker image user" ${USER} && \
    chown ${USER}:${GROUP} ${HOME} && \
    usermod -a -G sudo ${USER} && \
		echo "${PASSWORD}\n${PASSWORD}" | passwd ${USER}

USER ${USER}

# Prepare aplication repository for development
EXPOSE 3000
RUN mkdir ${HOME}/app
WORKDIR ${HOME}/app
RUN git clone https://github.com/rfejzic1/theia_etf.git .

# Keep the container running...
CMD tail -f /dev/null
